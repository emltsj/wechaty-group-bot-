import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// .env 默认路径
export const DEFAULT_ENV_PATH = path.resolve(__dirname, '..', '.env')
export const ENV_PATH = DEFAULT_ENV_PATH // 兼容旧代码

// 群发文案的 key（这些值里的 \n 字面量会被还原成真正的换行）
const MESSAGE_KEY_RE = /^SCHEDULE_MESSAGE_/

/**
 * 把文案里的 \n / \r\n / \r 字面量还原成真正的换行
 * 这样 SCHEDULE_MESSAGE_DAILY='第一行\n第二行' 也能正确分段
 */
export function decodeLineBreaks(value) {
  return value.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n')
}

/**
 * .env 解析器
 * 支持三种写法：
 *   1. 跨多行的带引号值（推荐）
 *   2. 单行带引号值，用 \n 表示换行
 *   3. 单行不带引号的值
 */
export class ConfigManager {
  constructor(envPath = DEFAULT_ENV_PATH) {
    this.envPath = envPath
    this.config = {}
    this.loadConfig()
  }

  loadConfig() {
    try {
      const envContent = fs.readFileSync(this.envPath, 'utf-8')
      const newConfig = {}
      const lines = envContent.split(/\r?\n/)

      const setValue = (key, value) => {
        newConfig[key] = MESSAGE_KEY_RE.test(key) ? decodeLineBreaks(value) : value
      }

      let i = 0
      while (i < lines.length) {
        const line = lines[i].trim()
        i++

        if (!line || line.startsWith('#')) continue

        const eqIndex = line.indexOf('=')
        if (eqIndex === -1) continue

        const key = line.substring(0, eqIndex).trim()
        const rest = line.substring(eqIndex + 1).trim()
        const quote = rest.startsWith("'") || rest.startsWith('"') ? rest[0] : ''

        // 没有引号：单行值
        if (!quote) {
          setValue(key, rest)
          continue
        }

        // 去掉开头引号，判断是否在同一行结束
        const value = rest.slice(1)
        if (value.endsWith(quote)) {
          setValue(key, value.slice(0, -1))
          continue
        }

        // 跨行值：一直读到以引号结尾的那一行为止
        const parts = [value]
        let closed = false
        while (i < lines.length) {
          const current = lines[i]
          i++
          if (current.endsWith(quote)) {
            parts.push(current.slice(0, -1))
            closed = true
            break
          }
          parts.push(current)
        }

        if (!closed) {
          console.warn(`[${new Date().toLocaleString()}] ⚠️ ${key} 的引号没有闭合，已读到文件末尾，请检查 ${path.basename(this.envPath)}`)
        }
        setValue(key, parts.join('\n'))
      }

      this.config = newConfig

      // 打印每条群发文案的行数，方便确认换行是否被正确读取
      const summary = ['DAILY', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
        .map(day => {
          const value = newConfig[`SCHEDULE_MESSAGE_${day}`]
          return value ? `${day}:${value.split('\n').length}行` : null
        })
        .filter(Boolean)
        .join('  ')

      console.log(`[${new Date().toLocaleString()}] ✅ 配置已加载/刷新`)
      if (summary) {
        console.log(`[${new Date().toLocaleString()}] 📄 群发文案行数  ${summary}`)
      }
      return true
    } catch (err) {
      console.error(`[${new Date().toLocaleString()}] ❌ 加载配置失败:`, err.message)
      return false
    }
  }

  get(key, defaultValue = '') {
    return this.config[key] || defaultValue
  }

  getMasterName() {
    return this.get('MASTER_NAME', '')
  }

  getRoomList() {
    const list = this.get('ROOM_LIST', '')
    return list ? list.split(',').map(s => s.trim()).filter(Boolean) : []
  }

  getDailyMessage() {
    return this.get('SCHEDULE_MESSAGE_DAILY', '')
  }

  getDayMessage(day) {
    const dayMap = {
      1: 'SCHEDULE_MESSAGE_MON',
      2: 'SCHEDULE_MESSAGE_TUE',
      3: 'SCHEDULE_MESSAGE_WED',
      4: 'SCHEDULE_MESSAGE_THU',
      5: 'SCHEDULE_MESSAGE_FRI',
      6: 'SCHEDULE_MESSAGE_SAT',
      0: 'SCHEDULE_MESSAGE_SUN'
    }
    return this.get(dayMap[day], '')
  }

  getDayImage(day) {
    const dayImageMap = {
      1: 'SCHEDULE_IMAGE_MON',
      2: 'SCHEDULE_IMAGE_TUE',
      3: 'SCHEDULE_IMAGE_WED',
      4: 'SCHEDULE_IMAGE_THU',
      5: 'SCHEDULE_IMAGE_FRI',
      6: 'SCHEDULE_IMAGE_SAT',
      0: 'SCHEDULE_IMAGE_SUN'
    }
    return this.get(dayImageMap[day], '')
  }

  getDailyImage() {
    return this.get('SCHEDULE_IMAGE_DAILY', '')
  }
}
