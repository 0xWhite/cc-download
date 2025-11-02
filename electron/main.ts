import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import {
  mkdir,
  readFile,
  writeFile,
  access,
  rm,
  stat,
  rename,
} from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import type {
  DownloadEvent,
  DownloadItem,
  DownloadStatus,
} from '../src/features/downloads/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const ytDlp = require('yt-dlp-exec') as typeof import('yt-dlp-exec')
const ffmpegStatic = require('ffmpeg-static') as string

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

registerDownloadHandlers()
registerWindowHandlers()

function createWindow() {
  const isMac = process.platform === 'darwin'

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    // macOS 使用 hidden 保留原生按钮，Windows 使用 frame: false
    ...(isMac
      ? {
          titleBarStyle: 'hidden',
          trafficLightPosition: { x: 16, y: 16 },
        }
      : {
          frame: false,
        }),
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // 开发模式下禁用 web 安全以允许加载外部图片
      webSecurity: !VITE_DEV_SERVER_URL,
    },
  })

  // 设置 CSP 允许加载外部图片
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; img-src 'self' data: http: https: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
        ],
      },
    })
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

// ----------------------------- Downloads -----------------------------

type DownloadTask = {
  id: string
  url: string
  status: DownloadStatus
  process: ReturnType<typeof ytDlp.exec>
  outputFile?: string
  title?: string
  thumbnail?: string
  duration?: number
  durationText?: string
  source?: string
  directory?: string
}

type AppSettings = {
  downloadDir: string | null
}

const DEFAULT_SETTINGS: AppSettings = {
  downloadDir: null,
}

let settingsCache: AppSettings | null = null

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

async function loadSettings(): Promise<AppSettings> {
  if (settingsCache) {
    return settingsCache
  }

  try {
    const raw = await readFile(getSettingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    settingsCache = { ...DEFAULT_SETTINGS, ...parsed }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code !== 'ENOENT') {
      console.error('Failed to read settings file', error)
    }
    settingsCache = { ...DEFAULT_SETTINGS }
  }

  return settingsCache
}

async function persistSettings(settings: AppSettings) {
  settingsCache = settings
  await writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}

async function updateSettings(partial: Partial<AppSettings>) {
  const current = await loadSettings()
  const next = { ...current, ...partial }
  await persistSettings(next)
  return next
}

const activeDownloads = new Map<string, DownloadTask>()

type SupportedBinary = 'yt-dlp' | 'ffmpeg'

function resolvePlatformFolder() {
  switch (process.platform) {
    case 'win32':
      return 'win32'
    case 'darwin':
      return 'darwin'
    default:
      return 'linux'
  }
}

async function ensureBinary(filePath: string, label: string) {
  try {
    await access(filePath)
  } catch {
    throw new Error(`${label} binary not found: ${filePath}`)
  }
}

async function getBundledBinary(name: SupportedBinary) {
  // 使用 ffmpeg-static 包提供的 ffmpeg
  if (name === 'ffmpeg') {
    if (!ffmpegStatic) {
      throw new Error('ffmpeg-static not found')
    }
    await ensureBinary(ffmpegStatic, name)
    return ffmpegStatic
  }

  // yt-dlp 继续从 bin 目录读取
  const platformFolder = resolvePlatformFolder()
  const dir = app.isPackaged
    ? path.join(process.resourcesPath, 'bin', platformFolder)
    : path.join(process.cwd(), 'bin', platformFolder)
  const ext = process.platform === 'win32' ? '.exe' : ''
  const fullPath = path.join(dir, `${name}${ext}`)
  await ensureBinary(fullPath, name)
  return fullPath
}

type ResolvedHeaders = {
  headers: Record<string, string>
  referer?: string
}

type VideoMetadata = {
  title?: string
  duration?: number
  durationText?: string
  thumbnail?: string
  source?: string
}

async function fetchMetadata(
  ytDlpPath: string,
  url: string
): Promise<VideoMetadata> {
  const resolved = resolveHeaders(url)
  const headers = resolved.headers
  try {
    const runner = ytDlp.create(ytDlpPath)
    const headerPairs = Object.entries(headers).map(
      ([key, value]) => `${key}:${value}`
    )
    const headerOption = headerPairs.length <= 1 ? headerPairs[0] : headerPairs
    const options: Record<string, unknown> = {
      dumpSingleJson: true,
      skipDownload: true,
      noWarnings: true,
      simulate: true,
      quiet: true,
      addHeader: headerOption as unknown as string,
    }
    if (resolved.referer) {
      options.referer = resolved.referer
    }
    const info = (await runner(url, options)) as {
      title?: string
      duration?: number
      thumbnail?: string
      thumbnails?: Array<{ url?: string }>
      extractor_key?: string
      extractor?: string
      webpage_url?: string
    }
    const thumbnails = info.thumbnails ?? []
    const bestThumbnail =
      info.thumbnail ?? [...thumbnails].reverse().find((item) => item.url)?.url
    const metadata = {
      title: info.title,
      duration: info.duration,
      durationText: (info as { duration_string?: string }).duration_string,
      thumbnail: bestThumbnail,
      source:
        info.extractor_key ?? info.extractor ?? info.webpage_url ?? undefined,
    }

    // 打印视频信息到控制台
    console.log('[ccd] 获取到视频信息:')
    console.log('  标题:', metadata.title || '未知')
    console.log(
      '  时长:',
      metadata.durationText ||
        (metadata.duration ? `${metadata.duration}秒` : '未知')
    )
    console.log('  来源:', metadata.source || '未知')
    console.log('  封面:', metadata.thumbnail ? '已获取' : '未获取')
    console.log('  完整信息:', JSON.stringify(metadata, null, 2))

    return metadata
  } catch (error) {
    console.error('[ccd] failed to fetch metadata', error)
    // 抛出错误而不是返回空对象
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`获取视频信息失败: ${errorMessage}`)
  }
}

function resolveHeaders(url: string): ResolvedHeaders {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  }

  const lower = url.toLowerCase()
  let referer: string | undefined
  if (lower.includes('bilibili.com')) {
    referer = 'https://www.bilibili.com'
    headers['Origin'] = 'https://www.bilibili.com'
  }

  return { headers, referer }
}

function sanitizeFilename(input: string) {
  return (
    input
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'video'
  )
}

function deriveTitleFromUrl(url: string) {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    let candidate = segments.pop() || parsed.hostname
    candidate = decodeURIComponent(candidate)
    if (candidate.includes('.')) {
      candidate = candidate.split('.').slice(0, -1).join('.') || candidate
    }
    return sanitizeFilename(candidate)
  } catch (error) {
    console.warn('[ccd] failed to derive title from url', error)
    return sanitizeFilename('video')
  }
}

async function ensureUniqueOutputPath(
  directory: string,
  rawTitle?: string,
  overwrite = false
) {
  const baseName = sanitizeFilename(rawTitle ?? `video-${Date.now()}`)
  if (overwrite) {
    const template = path.join(directory, `${baseName}.%(ext)s`)
    const absolutePath = path.join(directory, `${baseName}.mp4`)
    return { template, absolutePath }
  }

  let attempt = 0
  let candidateBase = baseName
  while (true) {
    const template = path.join(directory, `${candidateBase}.%(ext)s`)
    const absolutePath = path.join(directory, `${candidateBase}.mp4`)
    try {
      await stat(absolutePath)
      attempt += 1
      candidateBase = `${baseName}(${attempt})`
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'ENOENT') {
        return { template, absolutePath }
      }
      throw error
    }
  }
}

async function ensureFinalFilePath(
  directory: string,
  rawTitle: string,
  ext: string,
  currentPath?: string
) {
  const sanitized = sanitizeFilename(rawTitle)
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`
  let attempt = 0
  while (true) {
    const candidateName = attempt === 0 ? sanitized : `${sanitized}(${attempt})`
    const candidatePath = path.join(directory, `${candidateName}${safeExt}`)
    if (
      currentPath &&
      path.resolve(candidatePath) === path.resolve(currentPath)
    ) {
      return candidatePath
    }
    try {
      await stat(candidatePath)
      attempt += 1
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'ENOENT') {
        return candidatePath
      }
      throw error
    }
  }
}

function registerDownloadHandlers() {
  ipcMain.handle(
    'download:start',
    async (
      _event,
      payload: {
        url: string
        downloadType?: 'video' | 'audio'
        force?: boolean
        overrideId?: string
        existingFilePath?: string
        existingTitle?: string
        title?: string
        thumbnail?: string
        duration?: number
        durationText?: string
        source?: string
      }
    ) => {
      const url = payload?.url?.trim()
      if (!url) {
        throw new Error('URL is required')
      }

      const id = payload?.overrideId?.trim() || randomUUID()
      const settings = await loadSettings()
      if (!settings.downloadDir) {
        throw new Error('尚未选择下载目录')
      }

      await mkdir(settings.downloadDir, { recursive: true })

      const ytDlpPath = await getBundledBinary('yt-dlp')
      const ffmpegPath = await getBundledBinary('ffmpeg').catch(() => null)
      const resolvedHeaders = resolveHeaders(url)
      const headerPairs = Object.entries(resolvedHeaders.headers).map(
        ([key, value]) => `${key}:${value}`
      )
      const headerOption =
        headerPairs.length <= 1 ? headerPairs[0] : headerPairs

      let initialTitle = payload?.title ?? payload?.existingTitle ?? deriveTitleFromUrl(url)
      let finalPath: { template: string; absolutePath: string }

      if (payload?.force && payload.existingFilePath) {
        const ext = path.extname(payload.existingFilePath) || '.mp4'
        const base = path.basename(payload.existingFilePath, ext)
        initialTitle = payload?.title ?? payload.existingTitle ?? base
        finalPath = {
          template: path.join(
            path.dirname(payload.existingFilePath),
            `${base}.%(ext)s`
          ),
          absolutePath: payload.existingFilePath,
        }
      } else {
        finalPath = await ensureUniqueOutputPath(
          settings.downloadDir,
          initialTitle,
          payload?.force ?? false
        )
      }

      // 使用临时文件名格式，下载完成后再根据真实标题重命名
      const tempTemplate = path.join(settings.downloadDir, '%(id)s.%(ext)s')

      const flags: Record<string, unknown> = {
        newline: true,
        output: tempTemplate,
        format: payload.downloadType === 'audio'
          ? 'bestaudio/best'
          : 'bv*[vcodec^=avc1]+ba[acodec^=mp4a]/b[ext=mp4]/best[ext=mp4]/best',
        addHeader: headerOption as unknown as string,
      }
      
      if (payload.downloadType === 'audio') {
        // 音频模式：提取音频并转换为 MP3
        flags.extractAudio = true
        flags.audioFormat = 'mp3'
        flags.audioQuality = 0  // 最佳质量
        if (ffmpegPath) {
          flags.ffmpegLocation = ffmpegPath
        }
      } else {
        // 视频模式：现有逻辑
        if (ffmpegPath) {
          flags.ffmpegLocation = ffmpegPath
          flags.mergeOutputFormat = 'mp4'
          flags.remuxVideo = 'mp4'
        }
      }
      if (resolvedHeaders.referer) {
        flags.referer = resolvedHeaders.referer
      }
      if (payload?.force) {
        flags.forceOverwrites = true
        flags.noContinue = true
        try {
          await rm(finalPath.absolutePath, { force: true })
        } catch (error) {
          console.warn(
            '[ccd] failed to remove existing file before overwrite',
            error
          )
        }
      }

      const ytDlpModule = ytDlp as unknown as {
        args: (inputUrl: string, options: Record<string, unknown>) => string[]
      }
      const commandArgs = ytDlpModule.args(url, flags)
      console.info('[ccd] yt-dlp command:', ytDlpPath, commandArgs.join(' '))
      const ytDlpRunner = ytDlp.create(ytDlpPath)

      const env: NodeJS.ProcessEnv = { ...process.env }
      if (ffmpegPath) {
        env.FFMPEG_PATH = ffmpegPath
      }

      const spawned = ytDlpRunner.exec(url, flags, {
        windowsHide: true,
        env,
      })

      try {
        await once(spawned, 'spawn')
      } catch (error) {
        spawned.removeAllListeners()
        throw new Error(
          `无法启动 yt-dlp：${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }

      const task: DownloadTask = {
        id,
        url,
        status: 'queued',
        process: spawned,
        title: initialTitle,
        thumbnail: payload.thumbnail,
        duration: payload.duration,
        durationText: payload.durationText,
        source: payload.source,
        directory: settings.downloadDir,
        outputFile: finalPath.absolutePath,
      }
      activeDownloads.set(id, task)

      const downloadItem: DownloadItem = {
        id,
        url,
        status: 'queued',
        progress: { percent: 0 },
        title: initialTitle,
        downloadType: payload.downloadType || 'video',
        thumbnail: payload.thumbnail,
        duration: payload.duration,
        durationText: payload.durationText,
        source: payload.source,
        directory: settings.downloadDir,
        filePath: finalPath.absolutePath,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      broadcastDownloadEvent({ type: 'queued', payload: downloadItem })

      void enrichMetadata(task, url, settings.downloadDir)

      setupProcessListeners(task)

      return downloadItem
    }
  )

  ipcMain.handle('download:fetch-info', async (_event, url: string) => {
    const trimmed = url?.trim()
    if (!trimmed) {
      throw new Error('请输入视频链接')
    }

    try {
      const ytDlpPath = await getBundledBinary('yt-dlp')
      const metadata = await fetchMetadata(ytDlpPath, trimmed)

      // 检查是否真的获取到了视频信息
      if (
        !metadata.title &&
        !metadata.thumbnail &&
        !metadata.duration &&
        !metadata.source
      ) {
        throw new Error('无法获取视频信息，请检查链接是否正确')
      }

      return {
        url: trimmed,
        title: metadata.title,
        thumbnail: metadata.thumbnail,
        duration: metadata.duration,
        durationText: metadata.durationText,
        source: metadata.source,
      }
    } catch (error) {
      console.error('[ccd] failed to fetch video info', error)

      // 提供更友好的错误信息
      if (error instanceof Error) {
        const msg = error.message.toLowerCase()

        if (
          msg.includes('unsupported url') ||
          msg.includes('no video formats')
        ) {
          throw new Error('不支持的视频链接或平台')
        }
        if (
          msg.includes('private video') ||
          msg.includes('this video is unavailable')
        ) {
          throw new Error('视频不可用或需要登录访问')
        }
        if (msg.includes('video not found') || msg.includes('removed')) {
          throw new Error('视频已被删除或不存在')
        }
        if (msg.includes('copyright') || msg.includes('blocked')) {
          throw new Error('视频因版权原因无法访问')
        }
        if (msg.includes('geo') || msg.includes('region')) {
          throw new Error('视频因地区限制无法访问')
        }
        if (msg.includes('network') || msg.includes('connection')) {
          throw new Error('网络连接失败，请检查网络后重试')
        }

        // 直接返回原始错误信息
        throw error
      }

      throw new Error('获取视频信息失败')
    }
  })

  ipcMain.handle('settings:get-download-dir', async () => {
    const settings = await loadSettings()
    return settings.downloadDir
  })

  ipcMain.handle(
    'settings:set-download-dir',
    async (_event, dir: string | null) => {
      const sanitized = dir?.trim() ? path.resolve(dir) : null
      const next = await updateSettings({ downloadDir: sanitized })
      return next.downloadDir
    }
  )

  ipcMain.handle('settings:choose-download-dir', async () => {
    const window =
      BrowserWindow.getFocusedWindow() ??
      win ??
      BrowserWindow.getAllWindows()[0] ??
      null
    const result = await dialog.showOpenDialog(window ?? undefined, {
      title: '选择下载目录',
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const dir = result.filePaths[0]
    await mkdir(dir, { recursive: true })
    const next = await updateSettings({ downloadDir: dir })
    return next.downloadDir
  })

  ipcMain.handle(
    'download:open',
    async (_event, payload: { filePath?: string; directory?: string }) => {
      const filePath = payload?.filePath
      if (filePath) {
        try {
          await stat(filePath)
          shell.showItemInFolder(filePath)
          return
        } catch (error) {
          console.warn(
            '[ccd] file not found when opening, fallback to directory',
            error
          )
        }
        const folder = path.dirname(filePath)
        if (folder) {
          await shell.openPath(folder)
          return
        }
      }
      const directory = payload?.directory ?? (await loadSettings()).downloadDir
      if (directory) {
        await shell.openPath(directory)
      }
    }
  )

  ipcMain.handle(
    'download:delete',
    async (_event, payload: { id: string; filePath?: string }) => {
      if (payload.filePath) {
        try {
          await rm(payload.filePath, { force: true })
        } catch (error) {
          console.error(
            `[ccd] failed to delete file ${payload.filePath}`,
            error
          )
        }
      }
      broadcastDownloadEvent({ type: 'removed', payload: { id: payload.id } })
    }
  )

  app.on('before-quit', () => {
    for (const [, task] of activeDownloads) {
      if (!task.process.killed) {
        task.process.kill('SIGINT')
      }
    }
    activeDownloads.clear()
  })
}

async function enrichMetadata(
  task: DownloadTask,
  url: string,
  directory: string
) {
  try {
    console.log('[ccd] 开始获取视频元数据，URL:', url)
    const ytDlpPath = await getBundledBinary('yt-dlp')
    const metadata = await fetchMetadata(ytDlpPath, url)
    if (
      !metadata.title &&
      !metadata.thumbnail &&
      metadata.duration == null &&
      !metadata.source
    ) {
      console.log('[ccd] 未获取到任何元数据')
      return
    }

    task.title = metadata.title ?? task.title
    task.thumbnail = metadata.thumbnail ?? task.thumbnail
    task.duration = metadata.duration ?? task.duration
    task.durationText = metadata.durationText ?? task.durationText
    task.source = metadata.source ?? task.source

    console.log('[ccd] 元数据已应用到下载任务:')
    console.log('  任务ID:', task.id)
    console.log('  标题:', task.title)
    console.log('  时长文本:', task.durationText)
    console.log('  来源:', task.source)
    console.log('  封面URL:', task.thumbnail || '未获取')

    broadcastDownloadEvent({
      type: 'progress',
      payload: {
        id: task.id,
        title: task.title,
        thumbnail: task.thumbnail,
        duration: task.duration,
        durationText: task.durationText,
        source: task.source,
        directory,
        filePath: task.outputFile,
        progress: {},
      },
    })
  } catch (error) {
    console.warn('[ccd] failed to enrich metadata', error)
  }
}

async function finalizeDownload(task: DownloadTask) {
  try {
    if (!task.outputFile || !task.directory) {
      return undefined
    }

    const directory = task.directory
    const desiredTitle = task.title ?? deriveTitleFromUrl(task.url)

    // 尝试多种方式查找实际下载的文件
    let actualFile: string | undefined = undefined

    // 方法 1: 检查 outputFile 指向的文件
    try {
      await stat(task.outputFile)
      actualFile = task.outputFile
      console.log('[ccd] 找到文件 (直接路径):', actualFile)
    } catch {
      // 继续尝试其他方法
    }

    // 方法 2: 查找同名的 .mp4 文件
    if (!actualFile) {
      const baseName = path.basename(
        task.outputFile,
        path.extname(task.outputFile)
      )
      const mp4File = path.join(directory, `${baseName}.mp4`)
      try {
        await stat(mp4File)
        actualFile = mp4File
        console.log('[ccd] 找到文件 (.mp4):', actualFile)
      } catch {
        // 继续尝试其他方法
      }
    }

    // 方法 3: 在目录中查找最新的 .mp4 文件
    if (!actualFile) {
      try {
        const { readdir } = await import('node:fs/promises')
        const files = await readdir(directory)
        const mp4Files = files.filter((f) => f.endsWith('.mp4'))

        if (mp4Files.length > 0) {
          // 获取所有 .mp4 文件的修改时间
          const fileStats = await Promise.all(
            mp4Files.map(async (f) => {
              const fullPath = path.join(directory, f)
              const stats = await stat(fullPath)
              return { file: fullPath, mtime: stats.mtime }
            })
          )

          // 找到最新的文件
          fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
          actualFile = fileStats[0].file
          console.log('[ccd] 找到文件 (最新):', actualFile)
        }
      } catch (err) {
        console.warn('[ccd] 无法列出目录文件:', err)
      }
    }

    if (!actualFile) {
      console.warn('[ccd] 找不到下载的文件，预期路径:', task.outputFile)
      return task.outputFile
    }

    // 更新 task.outputFile
    task.outputFile = actualFile

    const ext = path.extname(actualFile) || '.mp4'
    const targetPath = await ensureFinalFilePath(
      directory,
      desiredTitle,
      ext,
      actualFile
    )

    if (path.resolve(targetPath) !== path.resolve(actualFile)) {
      console.log('[ccd] 重命名文件:')
      console.log('  从:', path.basename(actualFile))
      console.log('  到:', path.basename(targetPath))
      await rename(actualFile, targetPath)
      task.outputFile = targetPath
    } else {
      console.log('[ccd] 文件名已正确:', path.basename(actualFile))
    }

    return task.outputFile
  } catch (error) {
    console.error('[ccd] finalize download failed', error)
    return task.outputFile
  }
}

function setupProcessListeners(task: DownloadTask) {
  const { process: child, id } = task

  if (!child.stdout || !child.stderr) {
    handleFailure(task, '无法读取 yt-dlp 输出')
    return
  }

  const stdout = readline.createInterface({ input: child.stdout })
  const stderr = readline.createInterface({ input: child.stderr })

  const handleLine = (raw: string) => {
    const line = raw.trim()
    if (!line) return

    if (line.startsWith('[download] Destination:')) {
      const destination = line.replace('[download] Destination:', '').trim()
      task.outputFile = destination
      // 只有在没有从元数据获取到标题时，才使用文件名作为标题
      if (!task.title) {
        task.title = path.parse(destination).name
      }
      broadcastDownloadEvent({
        type: 'progress',
        payload: {
          id,
          title: task.title,
          filePath: destination,
          thumbnail: task.thumbnail,
          duration: task.duration,
          durationText: task.durationText,
          source: task.source,
          directory: task.directory,
          progress: { percent: task.status === 'completed' ? 100 : 0 },
        },
      })
      return
    }

    const progressMatch = line.match(/\[download\]\s+([\d.]+)%/i)
    if (progressMatch) {
      const percent = Number.parseFloat(progressMatch[1])
      const speedMatch = line.match(/at\s+([^\s]+\/s)/i)
      const etaMatch = line.match(/ETA\s+([^\s]+)/i)
      task.status = 'downloading'
      broadcastDownloadEvent({
        type: 'progress',
        payload: {
          id,
          status: 'downloading',
          title: task.title,
          progress: {
            percent: Number.isFinite(percent) ? percent : 0,
            speed: speedMatch?.[1] ?? undefined,
            eta: etaMatch?.[1] ?? undefined,
          },
          thumbnail: task.thumbnail,
          duration: task.duration,
          durationText: task.durationText,
          source: task.source,
          directory: task.directory,
          filePath: task.outputFile,
        },
      })
      return
    }

    if (line.startsWith('[Merger]') || line.startsWith('[ffmpeg]')) {
      task.status = 'processing'
      broadcastDownloadEvent({
        type: 'progress',
        payload: {
          id,
          status: 'processing',
          title: task.title,
          progress: { percent: 100 },
          thumbnail: task.thumbnail,
          duration: task.duration,
          durationText: task.durationText,
          source: task.source,
          directory: task.directory,
          filePath: task.outputFile,
        },
      })
      return
    }

    if (line.startsWith('ERROR')) {
      handleFailure(task, line)
    }
  }

  stdout.on('line', handleLine)
  stderr.on('line', handleLine)

  child.once('error', (error: Error) => {
    handleFailure(task, `yt-dlp 运行失败: ${error.message}`)
  })

  child.once('close', async (code: number | null) => {
    stdout.close()
    stderr.close()
    activeDownloads.delete(id)

    if (code === 0) {
      task.status = 'completed'
      const finalPath = await finalizeDownload(task)
      broadcastDownloadEvent({
        type: 'completed',
        payload: {
          id,
          filePath: finalPath ?? task.outputFile,
          title: task.title,
          directory: task.directory,
        },
      })
    } else if (task.status !== 'failed') {
      handleFailure(task, `下载进程退出，退出码 ${code ?? '未知'}`)
    }
  })
}

function handleFailure(task: DownloadTask, message: string) {
  task.status = 'failed'
  broadcastDownloadEvent({
    type: 'failed',
    payload: {
      id: task.id,
      error: message,
    },
  })
}

function broadcastDownloadEvent(event: DownloadEvent) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('download:event', event)
    }
  }
}

app.whenReady().then(async () => {
  try {
    const settings = await loadSettings()
    if (settings.downloadDir) {
      await mkdir(settings.downloadDir, { recursive: true })
    }
  } catch (error) {
    console.error('Failed to ensure downloads directory', error)
  }
})

// ----------------------------- Window Controls -----------------------------

function registerWindowHandlers() {
  ipcMain.handle('window:minimize', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      window.minimize()
    }
  })

  ipcMain.handle('window:maximize', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  })

  ipcMain.handle('window:close', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      window.close()
    }
  })

  ipcMain.handle('window:isMaximized', () => {
    const window = BrowserWindow.getFocusedWindow()
    return window ? window.isMaximized() : false
  })
}
