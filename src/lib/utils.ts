import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化观看数
 * @param count 观看次数
 * @returns 格式化的字符串，如 "1.2K", "3.5M", "1.8B"
 */
export function formatViewCount(count?: number): string {
  if (count === undefined || count === null) return '未知'
  
  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(1)}B`
  }
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`
  }
  return count.toString()
}

/**
 * 格式化上传日期
 * @param date 上传日期，格式可能为 YYYYMMDD
 * @returns 格式化的日期字符串，如 "2024-01-15"
 */
export function formatUploadDate(date?: string): string {
  if (!date) return '未知'
  
  // 如果是 YYYYMMDD 格式
  if (/^\d{8}$/.test(date)) {
    const year = date.substring(0, 4)
    const month = date.substring(4, 6)
    const day = date.substring(6, 8)
    return `${year}-${month}-${day}`
  }
  
  // 如果已经是 ISO 格式或其他格式，尝试解析
  try {
    const parsed = new Date(date)
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    }
  } catch {
    // 解析失败则返回原始值
  }
  
  return date
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化的文件大小，如 "125MB", "2.3GB"
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '未知'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  // 如果小于 10，显示一位小数；否则显示整数
  const formatted = size < 10 ? size.toFixed(1) : Math.round(size).toString()
  return `${formatted}${units[unitIndex]}`
}

/**
 * 格式化分辨率
 * @param width 宽度
 * @param height 高度
 * @returns 格式化的分辨率，如 "1080p", "720p", "4K"
 */
export function formatResolution(width?: number, height?: number): string {
  if (!width || !height) return '未知'
  
  // 常见分辨率映射
  if (height >= 2160) return '4K'
  if (height >= 1440) return '2K'
  if (height >= 1080) return '1080p'
  if (height >= 720) return '720p'
  if (height >= 480) return '480p'
  if (height >= 360) return '360p'
  
  return `${width}x${height}`
}
