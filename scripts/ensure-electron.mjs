#!/usr/bin/env node
/* eslint-env node */
/* global process, console */
import { execFileSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

async function fileExists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

function resolvePlatformPath(platform) {
  switch (platform) {
    case 'darwin':
    case 'mas':
      return 'Electron.app/Contents/MacOS/Electron'
    case 'linux':
    case 'freebsd':
    case 'openbsd':
      return 'electron'
    case 'win32':
      return 'electron.exe'
    default:
      throw new Error(`Unsupported Electron platform: ${platform}`)
  }
}

async function ensureElectron() {
  const electronPackageJsonPath = require.resolve('electron/package.json', {
    paths: [projectRoot],
  })
  const electronPkg = JSON.parse(
    await fs.readFile(electronPackageJsonPath, 'utf8'),
  )
  const electronDir = path.dirname(electronPackageJsonPath)
  const distDir = path.join(electronDir, 'dist')
  const pathTxt = path.join(electronDir, 'path.txt')

  async function electronReady() {
    if (!(await fileExists(pathTxt))) {
      return false
    }
    const relativeBinaryPath = await fs.readFile(pathTxt, 'utf8')
    const binaryPath = path.join(distDir, relativeBinaryPath.trim())
    return fileExists(binaryPath)
  }

  if (await electronReady()) {
    return
  }

  const version = electronPkg.version
  const platform = process.env.npm_config_platform || process.platform
  let arch = process.env.npm_config_arch || process.arch

  if (
    platform === 'darwin' &&
    process.platform === 'darwin' &&
    arch === 'x64' &&
    process.env.npm_config_arch === undefined
  ) {
    try {
      const translated = execFileSync('sysctl', ['-in', 'sysctl.proc_translated'])
        .toString()
        .trim()
      if (translated === '1') {
        arch = 'arm64'
      }
    } catch {
      // Ignore failures, fall back to reported arch
    }
  }

  const artifactName = `electron-v${version}-${platform}-${arch}.zip`
  const homeDir = os.homedir()
  const cacheCandidates = [
    process.env.electron_config_cache,
    process.env.ELECTRON_DOWNLOAD_CACHE,
    process.env.npm_config_electron_cache,
    path.join(projectRoot, 'node_modules/.cache/electron'),
    path.join(projectRoot, 'node_modules/.electron-cache'),
    path.join(homeDir, 'Library/Caches/electron'),
    path.join(homeDir, '.cache/electron'),
    process.env.XDG_CACHE_HOME && path.join(process.env.XDG_CACHE_HOME, 'electron'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'electron', 'Cache'),
    process.env.APPDATA && path.join(process.env.APPDATA, 'electron', 'Cache'),
  ]
    .filter(Boolean)
    .map((candidate) => path.resolve(candidate))

  let zipPath = null
  for (const basePath of cacheCandidates) {
    const candidate = path.join(basePath, artifactName)
    if (await fileExists(candidate)) {
      zipPath = candidate
      break
    }
  }

  if (!zipPath) {
    console.error(
      `[ensure-electron] Unable to locate pre-downloaded Electron archive ${artifactName}.`,
    )
    console.error(
      '[ensure-electron] Please connect to the network and run "pnpm install" (or rerun the Electron install script) to download it.',
    )
    process.exit(1)
  }

  const extract = require('extract-zip')

  await fs.rm(distDir, { recursive: true, force: true })
  await fs.mkdir(distDir, { recursive: true })
  await extract(zipPath, { dir: distDir })

  const typeDefSource = path.join(distDir, 'electron.d.ts')
  if (await fileExists(typeDefSource)) {
    await fs.rename(typeDefSource, path.join(electronDir, 'electron.d.ts'))
  }

  const platformPath = resolvePlatformPath(platform)
  await fs.writeFile(pathTxt, `${platformPath}\n`, 'utf8')

  if (!(await electronReady())) {
    throw new Error(
      'Electron restore completed but the binary is still missing. Please reinstall Electron.',
    )
  }

  console.log(
    `[ensure-electron] Restored Electron ${version} from local cache: ${zipPath}`,
  )
}

ensureElectron().catch((error) => {
  console.error('[ensure-electron] Failed to prepare Electron binaries:')
  console.error(error)
  process.exit(1)
})
