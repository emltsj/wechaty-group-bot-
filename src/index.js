import { WechatyBuilder } from 'wechaty'
import schedule from 'node-schedule'
import chokidar from 'chokidar'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ConfigManager, DEFAULT_ENV_PATH } from './env-config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 分店配置：默认读取 .env, env2, env3, env4
const STORE_ENV_FILES = ['.env', 'env2', 'env3', 'env4']

// ========== 分店 ==========
class Store {
  constructor(envPath, name) {
    this.name = name
    this.envPath = envPath
    this.configManager = new ConfigManager(envPath)
    this.rooms = new Set()
  }
}

// ========== 微信机器人 ==========
class WechatBot {
  constructor() {
    this.stores = []
    this.bot = null
    this.jobs = [] // 存储定时任务
    this.isLoggedIn = false
    this.roomCache = new Map() // 缓存群对象，减少 Room.find 调用
    this.lastSent = new Map() // 记录最近发送，防止重复发送
  }

  async start() {
    // 加载所有分店配置
    this.loadStores()

    // 启动 env 文件监听（热修改功能）
    this.watchEnvFiles()

    // 启动时预览今日所有分店群发内容
    this.logTodayPreview()

    // 创建微信机器人（puppet 用模块名指定，uos 协议登录）
    this.bot = WechatyBuilder.build({
      name: 'wechat-bot',
      puppet: 'wechaty-puppet-wechat4u',
      puppetOptions: {
        uos: true
      }
    })

    this.setupEventHandlers()
    await this.bot.start()
  }

  loadStores() {
    console.log(`[${new Date().toLocaleString()}] 🏪 正在加载分店配置...`)
    this.stores = []

    let storeIndex = 0
    STORE_ENV_FILES.forEach((file) => {
      const envPath = path.resolve(__dirname, '..', file)
      if (fs.existsSync(envPath)) {
        const name = storeIndex === 0 ? '总店' : `分店${storeIndex}`
        this.stores.push(new Store(envPath, name))
        console.log(`[${new Date().toLocaleString()}] ✅ ${name} 配置已加载 (${file})`)
        storeIndex++
      } else {
        console.log(`[${new Date().toLocaleString()}] ⚠️ 未找到 ${file}，跳过`)
      }
    })

    if (this.stores.length === 0) {
      console.warn(`[${new Date().toLocaleString()}] ⚠️ 没有加载到任何分店配置，将使用默认 .env`)
      this.stores.push(new Store(DEFAULT_ENV_PATH, '总店'))
    }
  }

  setupEventHandlers() {
    // 扫码登录
    this.bot.on('scan', (qrcode, status) => {
      console.log(`[${new Date().toLocaleString()}] 📱 扫码登录: ${status}`)
      console.log(`二维码链接: https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrcode)}`)
    })

    // 登录成功
    this.bot.on('login', (user) => {
      console.log(`[${new Date().toLocaleString()}] ✅ 登录成功: ${user.name()}`)
      this.isLoggedIn = true
      this.setupSchedules()
    })

    // 登出
    this.bot.on('logout', (user) => {
      console.log(`[${new Date().toLocaleString()}] 👋 已登出: ${user.name()}`)
      this.isLoggedIn = false
      this.clearSchedules()
      this.roomCache.clear()
      this.lastSent.clear()
    })

    // 收到消息
    this.bot.on('message', async (msg) => {
      await this.handleMessage(msg)
    })

    // 错误处理
    this.bot.on('error', (err) => {
      console.error(`[${new Date().toLocaleString()}] ❌ 错误:`, err.message)
    })
  }

  async handleMessage(msg) {
    try {
      const room = msg.room()
      const contact = msg.talker()
      const text = msg.text()

      // 只处理群消息
      if (!room) return

      const roomTopic = await room.topic()

      // 如果主人在群里说话，自动加入对应分店的发送列表
      this.stores.forEach(store => {
        const masterName = store.configManager.getMasterName()
        if (masterName && contact.name() === masterName) {
          if (!store.rooms.has(roomTopic)) {
            store.rooms.add(roomTopic)
            console.log(`[${new Date().toLocaleString()}] ➕ [${store.name}] 自动添加群: ${roomTopic}`)
          }
        }
      })

      // 处理命令
      if (text.startsWith('#')) {
        await this.handleCommand(msg, text, room, roomTopic)
      }
    } catch (err) {
      console.error(`[${new Date().toLocaleString()}] ❌ 处理消息失败:`, err.message)
    }
  }

  // 获取与当前群相关联的分店（未关联则默认返回总店）
  getStoresByRoom(roomTopic) {
    const associated = this.stores.filter(store =>
      store.configManager.getRoomList().includes(roomTopic) || store.rooms.has(roomTopic)
    )
    return associated.length > 0 ? associated : [this.stores[0]]
  }

  formatStoreNames(stores) {
    return stores.map(s => s.name).join(', ')
  }

  // 带缓存的 Room.find，减少重复查找
  async findRoom(topic) {
    if (this.roomCache.has(topic)) {
      return this.roomCache.get(topic)
    }
    const room = await this.bot.Room.find({ topic })
    if (room) {
      this.roomCache.set(topic, room)
    }
    return room
  }

  invalidateRoomCache(topic) {
    this.roomCache.delete(topic)
  }

  // 生成最近发送记录的 key
  sentKey(storeName, topic, message) {
    return `${storeName}::${topic}::${this.hashMessage(message)}`
  }

  hashMessage(message) {
    let hash = 0
    for (let i = 0; i < message.length; i++) {
      hash = ((hash << 5) - hash) + message.charCodeAt(i)
      hash |= 0
    }
    return String(hash)
  }

  // 检查是否已在最近 5 分钟内发过同样内容
  isRecentlySent(storeName, topic, message) {
    const key = this.sentKey(storeName, topic, message)
    const last = this.lastSent.get(key)
    if (!last) return false
    return Date.now() - last < 5 * 60 * 1000
  }

  recordSent(storeName, topic, message) {
    const key = this.sentKey(storeName, topic, message)
    this.lastSent.set(key, Date.now())
  }

  // 随机延迟，用于降低操作频率
  async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  // 回复群消息前加随机延迟，避免瞬间响应像机器人
  async reply(msg, text) {
    await this.randomDelay(500, 1500)
    return msg.say(text)
  }

  async handleCommand(msg, text, room, roomTopic) {
    const command = text.trim().toLowerCase()
    const targetStores = this.getStoresByRoom(roomTopic)

    switch (command) {
      case '#添加群发':
        targetStores.forEach(store => store.rooms.add(roomTopic))
        await this.reply(msg, `✅ 已将本群「${roomTopic}」加入 ${this.formatStoreNames(targetStores)} 的群发列表`)
        console.log(`[${new Date().toLocaleString()}] ➕ [${this.formatStoreNames(targetStores)}] 手动添加群: ${roomTopic}`)
        break

      case '#移除群发':
        targetStores.forEach(store => store.rooms.delete(roomTopic))
        await this.reply(msg, `✅ 已将本群「${roomTopic}」从 ${this.formatStoreNames(targetStores)} 的群发列表移除`)
        console.log(`[${new Date().toLocaleString()}] ➖ [${this.formatStoreNames(targetStores)}] 手动移除群: ${roomTopic}`)
        break

      case '#群发列表': {
        const lines = targetStores.map(store => {
          const list = Array.from(store.rooms)
          return `[${store.name}] (${list.length}个群):\n${list.join('\n') || '无'}`
        })
        await this.reply(msg, `📋 当前群发列表：\n${lines.join('\n\n')}`)
        break
      }

      case '#测试群发':
        await this.reply(msg, '🔄 正在测试群发...')
        for (const store of targetStores) {
          await this.sendToStoreRooms(store, `🧪 [${store.name}] 这是一条测试消息`)
        }
        break

      case '#预览': {
        const today = new Date().getDay()
        const isWorkday = [1, 2, 3, 4, 5].includes(today)
        for (const store of targetStores) {
          const special = isWorkday ? store.configManager.getDayMessage(today) : ''
          const message = special || store.configManager.getDailyMessage()
          if (!message) {
            await this.reply(msg, `[${store.name}] ⚠️ 当前没有可预览的文案`)
            continue
          }
          await this.reply(msg, `[${store.name}] 今日文案（共 ${message.split('\n').length} 行）：\n${message}`)
        }
        break
      }

      case '#刷新配置':
        this.reloadConfig()
        await this.reply(msg, '🔄 配置已手动刷新')
        break

      case '#帮助':
        await this.reply(msg, `🤖 机器人命令列表:
#添加群发 - 将当前群加入对应分店的群发列表
#移除群发 - 将当前群从对应分店的群发列表移除
#群发列表 - 查看对应分店的群发列表
#测试群发 - 向对应分店的所有群发测试消息
#预览 - 在当前群预览对应分店今天实际会发送的文案
#刷新配置 - 手动刷新所有分店配置
#帮助 - 显示此帮助信息`)
        break
    }
  }

  // ========== 热修改监听 ==========
  watchEnvFiles() {
    const existingFiles = this.stores.map(s => s.envPath).filter(fs.existsSync)
    console.log(`[${new Date().toLocaleString()}] 👀 开始监听分店配置文件变化...`)

    const watcher = chokidar.watch(existingFiles, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    })

    watcher.on('change', (changedPath) => {
      console.log(`[${new Date().toLocaleString()}] 📝 检测到 ${path.basename(changedPath)} 文件变化，正在重新加载配置...`)
      this.reloadConfig()
    })

    watcher.on('error', (err) => {
      console.error(`[${new Date().toLocaleString()}] ❌ 文件监听错误:`, err.message)
    })
  }

  reloadConfig() {
    let anySuccess = false
    this.stores.forEach(store => {
      if (store.configManager.loadConfig()) {
        anySuccess = true
      }
    })

    if (anySuccess) {
      this.logTodayPreview()
      // 重新设置定时任务
      this.clearSchedules()
      if (this.isLoggedIn) {
        this.setupSchedules()
      }
      console.log(`[${new Date().toLocaleString()}] 🔄 定时任务已根据新配置刷新`)
    }
  }

  // 预览今日所有分店群发内容
  logTodayPreview() {
    const today = new Date().getDay()
    const isWorkday = [1, 2, 3, 4, 5].includes(today)
    const dayName = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][today]

    console.log(`[${new Date().toLocaleString()}] 👁️ 今日（${dayName}）群发预览：`)

    this.stores.forEach(store => {
      const special = isWorkday ? store.configManager.getDayMessage(today) : ''
      const message = special || store.configManager.getDailyMessage()
      const imagePath = special ? store.configManager.getDayImage(today) : store.configManager.getDailyImage()

      console.log(`\n🏪 [${store.name}]`)
      if (message) {
        console.log('--- 文案内容 ---')
        console.log(message)
        console.log(`--- 共 ${message.split('\n').length} 行 ---`)
      } else {
        console.log('⚠️ 今日没有配置群发文字')
      }

      if (imagePath) {
        console.log(`🖼️ 今日群发图片：${imagePath}`)
      } else {
        console.log('🖼️ 今日无群发图片')
      }
    })
  }

  // ========== 定时任务 ==========
  setupSchedules() {
    // 为每个分店加载固定群列表
    this.stores.forEach(store => {
      const fixedRooms = store.configManager.getRoomList()
      fixedRooms.forEach(room => store.rooms.add(room))
      console.log(`[${new Date().toLocaleString()}] 📋 [${store.name}] 已加载固定群列表: ${fixedRooms.join(', ') || '无'}`)
    })

    // 常规群发：每天 12:45 开始，每隔25分钟，不晚于17:00截单
    // 所有分店共用同一时间，触发后逐店发送
    const dailyTimes = this.generateTimesWithRandomOffset('12:45', '16:55', 25)
    dailyTimes.forEach(({ dayOfWeek, hour, minute, originalTime }) => {
      const job = schedule.scheduleJob({ dayOfWeek, hour, minute }, () => {
        this.sendDailyMessages()
      })
      this.jobs.push(job)
      console.log(`[${new Date().toLocaleString()}] ⏰ 已设置常规群发: ${originalTime} → ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    })

    // 特殊群发：周一到周五
    // 前一天晚上 19:30 开始，每30分钟一次，到凌晨 01:00 结束
    const specialDays = [1, 2, 3, 4, 5]

    specialDays.forEach(day => {
      const times = this.generateSpecialDayTimes(day)

      times.forEach(({ dayOfWeek, hour, minute, originalTime, label }) => {
        const job = schedule.scheduleJob({ dayOfWeek, hour, minute }, () => {
          this.sendDayMessages(day)
        })
        this.jobs.push(job)
        console.log(`[${new Date().toLocaleString()}] ⏰ 已设置周${['日', '一', '二', '三', '四', '五', '六'][day]}特殊群发(${label} ${originalTime} → ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')})`)
      })
    })

    console.log(`[${new Date().toLocaleString()}] ✅ 共设置了 ${this.jobs.length} 个定时任务`)
  }

  clearSchedules() {
    this.jobs.forEach(job => job.cancel())
    this.jobs = []
    console.log(`[${new Date().toLocaleString()}] 🧹 已清除所有定时任务`)
  }

  // 生成常规群发时间（带随机偏移）
  generateTimesWithRandomOffset(start, end, interval) {
    const times = []
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)

    let current = startHour * 60 + startMin
    const endTotal = endHour * 60 + endMin

    while (current <= endTotal) {
      const originalH = Math.floor(current / 60)
      const originalM = current % 60

      // 每天的任务
      for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
        const { dayOfWeek: adjustedDay, hour, minute } = this.normalizeTime(dayOfWeek, current)
        times.push({
          dayOfWeek: adjustedDay,
          hour,
          minute,
          originalTime: `${String(originalH).padStart(2, '0')}:${String(originalM).padStart(2, '0')}`
        })
      }

      current += interval
    }

    return times
  }

  // 生成特殊群发时间（前一天晚上19:30到凌晨01:00，每30分钟）
  generateSpecialDayTimes(day) {
    const times = []

    // 前一天晚上 19:30, 20:00, 20:30, 21:00, 21:30, 22:00, 22:30, 23:00, 23:30
    const prevDayOfWeek = day === 1 ? 0 : day - 1
    let current = 19 * 60 + 30 // 19:30
    const endOfEvening = 23 * 60 + 30 // 23:30

    while (current <= endOfEvening) {
      const { dayOfWeek, hour, minute } = this.normalizeTime(prevDayOfWeek, current)
      const originalH = Math.floor(current / 60)
      const originalM = current % 60

      times.push({
        dayOfWeek,
        hour,
        minute,
        originalTime: `${String(originalH).padStart(2, '0')}:${String(originalM).padStart(2, '0')}`,
        label: '前晚'
      })

      current += 30
    }

    // 当天凌晨 00:00, 00:30, 01:00
    const earlyMorningTimes = ['00:00', '00:30', '01:00']
    earlyMorningTimes.forEach(time => {
      const [originalH, originalM] = time.split(':').map(Number)
      const totalMinutes = originalH * 60 + originalM
      const { dayOfWeek, hour, minute } = this.normalizeTime(day, totalMinutes)

      times.push({
        dayOfWeek,
        hour,
        minute,
        originalTime: time,
        label: '凌晨'
      })
    })

    // 当天上午 07:00 ~ 10:45，每25分钟提醒一次
    let morningCurrent = 7 * 60 // 07:00
    const morningEnd = 10 * 60 + 45 // 10:45

    while (morningCurrent <= morningEnd) {
      const { dayOfWeek, hour, minute } = this.normalizeTime(day, morningCurrent)
      const originalH = Math.floor(morningCurrent / 60)
      const originalM = morningCurrent % 60

      times.push({
        dayOfWeek,
        hour,
        minute,
        originalTime: `${String(originalH).padStart(2, '0')}:${String(originalM).padStart(2, '0')}`,
        label: '上午'
      })

      morningCurrent += 25
    }

    return times
  }

  // 规范化时间：处理跨天和负数时间
  normalizeTime(dayOfWeek, totalMinutes) {
    let adjustedMinutes = totalMinutes + this.getRandomOffset()
    let adjustedDay = dayOfWeek

    // 处理跨到前一天
    while (adjustedMinutes < 0) {
      adjustedMinutes += 24 * 60
      adjustedDay = (adjustedDay - 1 + 7) % 7
    }

    // 处理跨到下一天
    while (adjustedMinutes >= 24 * 60) {
      adjustedMinutes -= 24 * 60
      adjustedDay = (adjustedDay + 1) % 7
    }

    return {
      dayOfWeek: adjustedDay,
      hour: Math.floor(adjustedMinutes / 60),
      minute: adjustedMinutes % 60
    }
  }

  // 应用 ±3 分钟随机偏移
  getRandomOffset() {
    return Math.floor(Math.random() * 7) - 3 // -3 ~ +3
  }

  // ========== 发送消息 ==========
  async sendDailyMessages() {
    for (const store of this.stores) {
      const message = store.configManager.getDailyMessage()
      const imagePath = store.configManager.getDailyImage()
      if (message) {
        await this.sendToStoreRooms(store, message, imagePath)
      }
    }
  }

  async sendDayMessages(day) {
    for (const store of this.stores) {
      const message = store.configManager.getDayMessage(day)
      const imagePath = store.configManager.getDayImage(day)
      if (message) {
        await this.sendToStoreRooms(store, message, imagePath)
      }
    }
  }

  async sendToStoreRooms(store, message, imagePath = '') {
    if (!this.isLoggedIn) {
      console.log(`[${new Date().toLocaleString()}] ⚠️ 未登录，无法发送消息`)
      return
    }

    const rooms = Array.from(store.rooms)
    if (rooms.length === 0) {
      console.log(`[${new Date().toLocaleString()}] ⚠️ [${store.name}] 没有目标群`)
      return
    }

    // 检查图片是否存在
    let imageFileBox = null
    if (imagePath) {
      const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(__dirname, '..', imagePath)
      if (fs.existsSync(absolutePath)) {
        try {
          const { FileBox } = await import('file-box')
          imageFileBox = FileBox.fromFile(absolutePath)
          console.log(`[${new Date().toLocaleString()}] 🖼️ [${store.name}] 图片已加载: ${absolutePath}`)
        } catch (err) {
          console.error(`[${new Date().toLocaleString()}] ❌ [${store.name}] 加载图片失败:`, err.message)
        }
      } else {
        console.log(`[${new Date().toLocaleString()}] ⚠️ [${store.name}] 图片文件不存在: ${absolutePath}`)
      }
    }

    let successCount = 0
    let skipCount = 0
    let failCount = 0

    console.log(`[${new Date().toLocaleString()}] 📤 [${store.name}] 开始群发消息到 ${rooms.length} 个群...`)

    for (const roomTopic of rooms) {
      try {
        // 5 分钟内已发过相同内容则跳过
        if (this.isRecentlySent(store.name, roomTopic, message)) {
          skipCount++
          continue
        }

        const room = await this.findRoom(roomTopic)
        if (!room) {
          console.log(`[${new Date().toLocaleString()}] ⚠️ [${store.name}] 未找到群: ${roomTopic}`)
          failCount++
          continue
        }

        // 先发送文字
        await room.say(message)
        this.recordSent(store.name, roomTopic, message)
        successCount++

        // 如果有图片，延迟 1.5~2.5 秒后发送图片
        if (imageFileBox) {
          await this.randomDelay(1500, 2500)
          await room.say(imageFileBox)
        }
      } catch (err) {
        failCount++
        this.invalidateRoomCache(roomTopic)
        console.error(`[${new Date().toLocaleString()}] ❌ [${store.name}] 发送到 ${roomTopic} 失败:`, err.message)
      }

      // 群与群之间随机延迟 2~5 秒，避免发送过快
      await this.randomDelay(2000, 5000)
    }

    console.log(`[${new Date().toLocaleString()}] ✅ [${store.name}] 群发完成 成功:${successCount} 跳过:${skipCount} 失败:${failCount}`)
  }
}

// ========== 启动 ==========
console.log(`
╔══════════════════════════════════════════╗
║     微信定时群发机器人 v1.0.0            ║
║     支持 .env 热修改功能                 ║
║     支持多分店配置 (.env/env2/env3/env4) ║
╚══════════════════════════════════════════╝
`)

const bot = new WechatBot()
bot.start().catch(err => {
  console.error(`[${new Date().toLocaleString()}] ❌ 启动失败:`, err.message)
  process.exit(1)
})

// 优雅退出
process.on('SIGINT', async () => {
  console.log(`\n[${new Date().toLocaleString()}] 👋 正在关闭机器人...`)
  process.exit(0)
})
