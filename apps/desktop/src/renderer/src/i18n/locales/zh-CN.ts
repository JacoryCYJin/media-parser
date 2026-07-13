export default {
  nav: {
    home: '首页',
    tools: '工具库',
    videoParser: '视频解析',
    blog: '博客',
    about: '关于我'
  },
  language: {
    label: '切换语言',
    zh: '中文',
    en: 'English'
  },
  settingsDialog: {
    kicker: '设置中心',
    title: '设置',
    close: '关闭设置',
    save: '保存',
    saving: '保存中',
    sections: {
      general: '通用设置',
      downloads: '下载设置',
      cookies: 'Cookie / 平台登录',
      models: '模型设置',
      about: '关于'
    },
    summaries: {
      general: '语言与基础偏好',
      downloads: '默认路径与本次路径',
      cookies: '登录态与平台 Cookie',
      models: '视频大纲等分析能力',
      about: '版本与更新'
    },
    general: {
      languageTitle: '界面语言'
    },
    downloads: {
      defaultTitle: '默认下载目录',
      temporaryTitle: '本次任务目录'
    },
    models: {
      currentTitle: '当前 API',
      connectionsTitle: 'API 连接',
      providerTitle: '分析模型来源',
      providers: {
        api: 'API'
      },
      apiTitle: 'API 接入',
      addTitle: '新增连接',
      editTitle: '编辑连接',
      name: '连接名称',
      type: '接口类型',
      openaiCompatible: 'OpenAI Compatible',
      baseUrl: 'Base URL',
      apiKey: 'API Key',
      model: '模型名',
      active: '当前使用',
      empty: '还没有 API 连接。',
      add: '新增连接',
      edit: '编辑',
      delete: '删除',
      select: '选中',
      test: '测试连接',
      testing: '测试中',
      cancel: '取消',
      noModel: '未填写模型名',
      saved: '模型设置已保存',
      selected: '当前 API 已切换',
      deleted: 'API 连接已删除',
      switched: '当前 API 已切换为 {name}',
      incomplete: '请填写 Base URL、API Key 和模型名',
      testPassed: '连接可用',
      testFailed: '连接测试失败',
      saveFailed: '模型设置保存失败',
      confirmDelete: '确定删除 API 连接「{name}」吗？'
    },
    about: {
      version: '版本',
      checkUpdates: '检测更新',
      checkingUpdates: '检测中',
      updateCheckStarted: '正在检查更新',
      updateCheckPackagedOnly: '当前开发版本不支持在线更新检测',
      updateCheckUnavailable: '更新检测暂不可用，请重启应用后再试',
      updateCheckFailed: '更新检测失败',
      projectHome: '项目主页',
      openProjectHome: 'jacoryspace',
      githubReleases: 'GitHub Releases',
      openGithubReleases: 'github.com/JacoryCYJin/media-parser/releases',
      openExternalFailed: '外部链接打开失败'
    }
  },
  home: {
    title: '欢迎来到 Jacory Space',
    subtitle: '分享技术、记录生活、探索可能',
    hero: {
      description: '一个为个人创作、工具、笔记与档案建立的数字空间。',
      keywords: '作品 · 工具 · 笔记 · 档案'
    },
    actions: {
      videoParser: '试试视频解析工具',
      about: '了解更多'
    },
    cards: {
      video: {
        title: '视频解析工具',
        description: '支持多平台视频解析，提供多种分辨率下载选项',
        action: '立即使用'
      },
      blog: {
        title: '博客文章',
        description: '技术分享、学习笔记、生活感悟',
        action: '查看文章'
      },
      tools: {
        title: '更多工具',
        description: '持续开发中，敬请期待',
        status: '即将上线'
      }
    }
  },
  tools: {
    videoParser: {
      title: '视频解析'
    },
    podcastParser: {
      title: '播客解析'
    },
    downloadsList: {
      title: '下载列表',
      kicker: '03 — 下载队列',
      description: '这里将用于集中查看视频与播客下载任务。列表内容和任务管理能力后续接入。'
    },
    sidebar: {
      toolsLabel: '工具切换',
      settingsLabel: '设置'
    },
    interfaceIndex: {
      kicker: '01 — 界面索引',
      description: '自建工具、界面实验、作品项目与系统组件的统一索引。',
      categoriesAria: '界面分类',
      summaryLabel: '摘要',
      lastUpdateLabel: '最后更新',
      filters: {
        all: '全部',
        tools: '工具',
        works: '作品',
        experiments: '实验',
        archived: '归档'
      },
      categoryDescriptions: {
        all: '完整空间索引与全部条目。',
        tools: '基础工具与界面元素。',
        works: '已发布项目与案例研究。',
        experiments: '研究、原型与探索。'
      },
      summary: {
        entries: '条目',
        live: '在线',
        wipBeta: '开发 / 测试',
        archived: '归档'
      }
    }
  },
  blog: {
    badge: 'Jacory Blog',
    title: '个人博客',
    subtitle: '记录开发过程、工具实践和生活观察，把零散想法整理成可复盘的文章。',
    readMore: '阅读全文',
    directionTitle: '文章方向',
    writingPlanTitle: '写作计划',
    writingPlanDescription: '这里会持续沉淀项目复盘、开发笔记和工具使用经验。后续可以继续扩展文章详情页或 Markdown 内容系统。',
    posts: {
      site: {
        title: '从零搭建个人网站的第一步',
        readingTime: '5 分钟阅读',
        summary: '梳理 Jacory Space 的前端页面结构、配色选择和工具入口，让个人网站先拥有清晰的表达框架。',
        tags: ['个人网站', 'Vue', 'Tailwind']
      },
      parser: {
        title: '视频解析工具的功能设计记录',
        readingTime: '7 分钟阅读',
        summary: '记录视频解析下载工具从输入链接、解析格式到下载目录设置的设计思路，以及后续可以优化的方向。',
        tags: ['工具开发', 'Node.js', 'yt-dlp']
      },
      workflow: {
        title: '为什么要给工作流写规则',
        readingTime: '4 分钟阅读',
        summary: '把分支、提交、PR 和合并流程写成规则，可以减少重复沟通，也让每次协作更容易复盘。',
        tags: ['Git', '协作', '工作流']
      },
      writing: {
        title: '把灵感整理成可发布内容',
        readingTime: '6 分钟阅读',
        summary: '从零散想法到博客文章，需要一个轻量的收集、筛选和整理流程，让创作更稳定地发生。',
        tags: ['写作', '创作', '复盘']
      }
    },
    categories: {
      project: '项目复盘',
      development: '开发笔记',
      workflow: '工作流',
      life: '生活观察'
    },
    fieldNotes: {
      journalLabel: '01 — 日志',
      archiveOpen: '{count} 篇 / 归档已开放',
      titleLead: 'Field',
      titleAccent: ' Notes',
      subtitleLead: 'Personal OS 的公开日志',
      subtitleBody: '所有记录都是未寄出的信，所有归档都是未完成的自证。',
      readEntry: '阅读全文',
      archiveAll: '归档 — 全部条目',
      filterLabel: '筛选',
      filterCategory: '分类',
      filterTopic: '主题',
      filterYear: '年份',
      filterAria: '筛选博客归档',
      endOfIndex: 'Jacory Space',
      footerNote: '这套系统就绪后，下一步才是具体的页面：写作、工具、作品集——都将活在这套冷白的语言里。',
      footer: {
        system: '系统',
        systemValue: 'Personal OS / v.01',
        surface: '入口',
        surfaceValue: '工具库 / 博客 / 关于我',
        accent: '联系',
        accentValue: 'Email / GitHub',
        status: '状态',
        statusValue: '持续构建中'
      }
    },
    post: {
      onThisNote: '本篇目录',
      backToFieldNotes: '返回日志列表',
      previousEntry: '上一篇',
      nextEntry: '下一篇',
      fieldNote: '现场笔记',
      headerLabel: '№ {index} — {category}',
      navAria: '文章导航',
      notFoundBadge: 'Error 404 / 条目未找到',
      notFoundTitle: '这篇笔记不存在'
    },
    entryCategories: {
      WEEKLY: '周刊',
      RESEARCH: '调研',
      ESSAY: '随笔',
      METHOD: '方法'
    },
    entryTopics: {
      PRODUCT: '产品'
    }
  },
  about: {
    sheet: {
      subtitle: 'Jacory',
      revision: '档案 03 / 修订 01',
      identityIllustrationAlt: 'Jacory 身份线稿'
    },
    slogan: {
      line1: '大海',
      line2Prefix: '',
      line2Emphasis: '辽阔',
      line2Suffix: '如初'
    },
    statement: '这里是我的个人数字空间。\n记录作品、沉淀工具、整理笔记，\n也是持续思考和构建的开放系统。\n长期迭代，持续进化。',
    identity: {
      roleLabel: '身份',
      role: '设计者 · 开发者 · 写作者 · 创作者',
      baseLabel: '实践方向',
      base: '软件开发 · Web 体验设计 · Agent 系统 · 视频创作',
      focusLabel: '系统',
      focus: '个人网站 · 视频 · 知识库 · 工作流',
      statusLabel: '状态',
      status: '公开构建中'
    },
    principles: {
      courage: '勇气',
      order: '秩序',
      curiosity: '好奇',
      expression: '表达',
      refinement: '打磨'
    },
    contact: {
      ariaLabel: '联系方式',
      label: '/ 联系',
      rssStatus: '待开放',
      thanks: '感谢来访。'
    },
  },
  podcastParser: {
    sections: {
      toolIndex: '№ 002 — PODCAST / LOCAL TOOL',
      input: '输入',
      result: '结果'
    },
    hero: {
      titleLead: '播客',
      titleSeparator: '',
      titleAccent: '解析',
      description: '解析 Apple Podcasts、小宇宙、RSS Feed 与音频链接，提取节目、单集、音频源与字幕状态。',
      editionLabel: '版本'
    },
    input: {
      placeholder: '粘贴 Apple Podcasts、小宇宙、RSS 或音频链接',
      parse: '解析',
      parsing: '解析中'
    },
    status: {
      ready: '就绪',
      resolving: '解析中',
      resolved: '已解析',
      partial: '部分结果',
      failed: '解析失败',
      failedShort: '失败',
      resolvingSource: '正在解析来源',
      missing: '缺失',
      unknown: 'unknown'
    },
    trail: {
      loading: '读取来源 / 检查字幕',
      failed: '解析失败',
      audioFound: '已找到音频',
      audioMissing: '未找到音频'
    },
    result: {
      coverAlt: '播客封面',
      untitledEpisode: '未命名单集',
      source: '来源',
      audio: '音频',
      audioSource: '音频源',
      audioSize: '音频大小',
      transcript: '字幕',
      summary: '总结'
    },
    messages: {
      resolvingSource: '正在读取播客来源、单集信息和公开字幕状态。',
      noAudio: '未返回公开音频源。',
      transcriptAvailable: '已找到公开字幕。',
      transcriptMarkerOnly: '来源存在字幕标记，但没有公开字幕内容。',
      transcriptInsufficient: '找到了公开字幕，但内容太短或噪声过多，暂时不可用。',
      transcriptMissing: '未找到公开字幕。'
    },
    actions: {
      showMore: '展开全部',
      showLess: '收起'
    },
    localStt: {
      action: '本地转写',
      retry: '重新转写',
      transcribing: '转写中',
      running: '正在本地转写，完成后会保存字幕。',
      complete: '本地转写完成，字幕已保存。',
      savedTo: '默认保存路径',
      reveal: '在 Finder 中显示',
      revealComplete: '已打开本地路径',
      stages: {
        queued: '排队中',
        downloading: '下载音频中',
        transcribing: '转写中',
        saving: '保存中',
        completed: '已完成',
        failed: '失败'
      }
    },
    errors: {
      emptyUrl: '请先粘贴播客、RSS 或音频链接。',
      invalidUrl: '请输入有效链接。',
      parseFailed: '播客解析失败：{message}',
      localSttFailed: '本地转写失败：{message}',
      revealFailed: '打开本地路径失败'
    }
  },
  videoParser: {
    title: '视频解析下载工具',
    subtitle: '支持 Bilibili、YouTube 等多平台视频解析',
    tip: '提示：支持 Bilibili、YouTube 等多平台视频解析与下载',
    pageDescription: '解析 YouTube / Bilibili 视频链接，获取可下载的音视频格式并保存到本地。',
    hero: {
      titleLead: '视频',
      titleSeparator: '',
      titleAccent: '解析'
    },
    ui: {
      settings: '设置',
      cookiesDirectory: 'Cookie'
    },
    cookieEntry: {
      label: 'Cookie 设置',
      hint: '当前视频需要 Cookies，请打开右上角设置完成 Cookie 配置后重试。'
    },
    sections: {
      command: '命令',
      status: '状态',
      videoInfo: '视频信息',
      downloadRegistry: '下载列表',
      outputPath: '输出路径',
      outlineMap: '大纲图',
      cookiesSettings: 'COOKIE 设置',
      directorySettings: '目录设置'
    },
    statusRail: {
      READY: '就绪',
      PARSING: '解析中',
      RESOLVED: '已解析',
      DOWNLOADING: '下载中',
      COMPLETE: '完成',
      COOKIES_REQUIRED: '需要 Cookies',
      FAILED: '失败'
    },
    info: {
      awaitingUrl: '等待链接',
      awaitingDescription: '粘贴视频链接并解析后，这里会显示封面、标题、来源、时长与视频信息。',
      source: '来源',
      duration: '时长',
      uploader: '上传者',
      pubDate: '发布时间',
      formatsAvailable: 'FORMATS AVAILABLE'
    },
    registry: {
      items: '{count} 项',
      empty: '未找到可下载的 MP4 / 音频格式。',
      resolution: '分辨率',
      format: '格式',
      size: '大小',
      status: '状态',
      action: '操作',
      processing: '处理中',
      rowStatus: {
        READY: '就绪',
        DOWNLOADING: '下载中',
        PAUSED: '已暂停',
        COMPLETE: '完成',
        FAILED: '失败',
        CANCELLED: '已取消',
        UNAVAILABLE: '不可用'
      },
      actions: {
        download: '下载',
        processing: '处理中',
        pause: '暂停',
        resume: '继续',
        cancel: '取消',
        redownload: '重新下载',
        retry: '重试',
        reveal: '显示',
        open: '打开'
      }
    },
    output: {
      pending: '下载完成后会显示本地保存路径。',
      copyPath: '复制路径',
      revealInFinder: '在 Finder 中显示',
      copied: '路径已复制'
    },
    outline: {
      copyOutline: '复制大纲',
      root: '视频大纲 / Outline',
      copied: '复制成功',
      generate: '生成大纲',
      retry: '重试生成',
      states: {
        idle: {
          title: '等待解析视频',
          description: '解析视频后可生成大纲。'
        },
        noSubtitles: {
          title: '暂无字幕',
          description: '未检测到平台字幕，暂时无法生成大纲。'
        },
        insufficient: {
          title: '字幕内容不足',
          description: '字幕内容不足，无法生成大纲。'
        },
        subtitlesAvailable: {
          title: '字幕可用',
          description: '已检测到字幕文本，可根据当前页面语言生成视频大纲。'
        },
        generating: {
          title: '正在生成大纲',
          description: '正在根据字幕内容生成视频大纲…'
        },
        success: {
          title: '大纲已生成',
          description: '视频大纲已生成。'
        },
        failed: {
          title: '生成失败',
          description: '生成大纲时出现问题，可以重试生成。'
        },
        empty: {
          title: '暂无大纲',
          description: '当前视频暂无可展示的大纲。'
        }
      }
    },
    settings: {
      mode: '模式',
      cookieModes: {
        manual: '手动',
        browser: '浏览器',
        none: '无'
      },
      browserSource: '浏览器来源',
      platformCookies: '平台 Cookie',
      set: '已设置',
      notSet: '未设置',
      usingBrowserCookies: '使用 {browser} 浏览器 Cookie',
      edit: '编辑',
      delete: '删除',
      custom: '自定义',
      cookiesUsageNote: 'Cookies 仅用于访问需要登录的私密或受限视频。',
      defaultDownloadDirectory: '默认下载目录',
      temporaryDirectory: '临时目录（本次下载）',
      useDefaultDirectory: '使用默认目录',
      change: '更改',
      temporaryDirectoryNote: '临时目录用于存放下载中临时文件，任务完成后可自动清理。'
    },
    thumbnailAlt: '视频缩略图',
    cookiesSettings: 'Cookies 设置',
    downloadSettings: '下载目录设置',
    inputPlaceholder: '请输入视频链接（支持 YouTube, Bilibili 等平台）',
    parse: '解析视频',
    parsing: '解析中...',
    loading: '正在解析视频...',
    duration: '时长',
    availableResolutions: '可用分辨率：',
    size: '大小',
    download: '下载',
    downloading: '下载中...',
    cookiesManagement: 'Cookies 管理',
    cookieUsage: 'Cookie 使用方式',
    cookieModes: {
      manual: '手动保存 Cookies',
      browser: '自动读取浏览器',
      none: '不使用 Cookies'
    },
    saveUsage: '保存使用方式',
    saving: '保存中...',
    cookieHelp: {
      browser: '会调用 yt-dlp 的 --cookies-from-browser {browser}，请先在对应浏览器登录视频平台。',
      manual: '使用下方保存到服务器的 cookies.txt，适合无法读取浏览器 Cookie 的场景。',
      none: '公开视频可尝试不使用 Cookies；需要登录的视频可能无法解析。'
    },
    status: {
      set: '已设置',
      unset: '未设置'
    },
    actions: {
      edit: '编辑',
      set: '设置',
      delete: '删除',
      add: '添加',
      cancel: '取消',
      save: '保存'
    },
    addCustomPlatform: '添加自定义平台',
    downloadDirectorySettings: '下载目录设置',
    defaultDownloadDirectory: '默认下载目录',
    notSet: '未设置',
    chooseDefaultDirectory: '选择默认目录',
    oneTimeDownloadDirectory: '本次下载目录（可选）',
    oneTimeDirectoryFallback: '未设置（将使用默认目录）',
    chooseOneTimeDirectory: '选择本次目录',
    clearOneTimeDirectory: '清空本次目录',
    addPlatformTitle: '添加自定义平台',
    platformPlaceholder: '输入平台名称（如：twitter、instagram）',
    setCookiesTitle: '设置 {platform} Cookies',
    cookiesSavedTip: '提示：Cookies 已保存在服务器，刷新页面不会丢失',
    cookiesPlaceholder: '粘贴 {platform} cookies.txt 内容到这里...',
    errors: {
      emptyUrl: '请输入视频链接',
      invalidUrl: '请输入有效的视频链接',
      noVisibleFormats: '未找到可下载的 MP4 / 音频格式。',
      parseFailed: '解析失败: {message}',
      downloadFailed: '下载失败: {message}',
      loadSettingsFailed: '加载设置失败',
      saveDefaultDirFailed: '保存默认下载目录失败',
      folderDialogFailed: '打开系统文件夹选择失败',
      revealFailed: '打开本地路径失败',
      outlineFailed: '生成大纲失败',
      saveCookieSettingsFailed: '保存 Cookie 使用方式失败',
      loadCookiesFailed: '加载 cookies 状态失败',
      saveFailed: '保存失败',
      deleteFailed: '删除失败',
      platformExists: '平台已存在'
    },
    messages: {
      readingMetadata: '正在读取视频元数据…',
      downloadingResolution: '正在下载 {resolution} 版本...',
      downloadComplete: '下载完成！文件保存在: {path}',
      revealComplete: '已打开本地路径',
      defaultDirSaved: '默认下载目录已保存: {path}',
      cookieUsageSaved: 'Cookie 使用方式已保存',
      confirmDeleteCookies: '确定要删除 {platform} 的 Cookies 吗？'
    }
  }
}
