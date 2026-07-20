/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // 马卡龙蓝色系：以白色为底，蓝为主调。
        // 每一档都偏柔（高亮度、低饱和），避免工业感。
        sky: {
          50:  '#f6f9fc', // 页面底色
          100: '#eef3fb', // 嵌套分区 / subpanel
          200: '#e0ebf7', // hover 浅色 / 选中背景
          300: '#c7d4e6', // 默认边框
          400: '#9bb5d3', // 次级边框 / 输入框占位
        },
        cloud: {
          50:  '#fbfcfe',
          100: '#f5f8fc',
          200: '#e8eef7',
          300: '#d3deec',
        },
        ink: {
          DEFAULT: '#22344f', // 主文字
          soft:    '#5b7290', // 次级文字
          muted:   '#8aa0bd', // 三级文字
        },
        // 主品牌（CTA / 链接 / active）
        macaron: {
          50:  '#f1f7fd',
          100: '#dceefc',
          200: '#bbddf7',
          300: '#7eb6f1', // ★ 主色（按钮、强调）
          400: '#5894dd', // hover
          500: '#3d7ec7', // pressed
          600: '#2a64a5', // 极深点缀
        },
        // 状态色：均按马卡龙调子降饱和
        ok:    '#7fcfa6',
        warn:  '#e9b86a',
        bad:   '#e8899b',
        mythos:'#b59fe6',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        // 给卡片 / 按钮更柔和的圆角
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        // 「折纸」：柔和落地投影 + 顶部一抹高光
        paper: '0 1px 0 rgba(255,255,255,0.9) inset, 0 6px 18px -10px rgba(34,52,79,0.18), 0 24px 48px -28px rgba(34,52,79,0.18)',
        lift:  '0 1px 0 rgba(255,255,255,0.9) inset, 0 10px 28px -12px rgba(34,52,79,0.22)',
      },
    },
  },
  plugins: [],
};