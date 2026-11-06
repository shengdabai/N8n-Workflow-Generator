import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Edit3, FileText, Download, Zap } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

interface NavItem {
  path: string
  label: string
  icon: ReactNode
}

const navItems: NavItem[] = [
  { path: '/', label: '首页', icon: <Home size={20} /> },
  { path: '/editor', label: '工作流编辑器', icon: <Edit3 size={20} /> },
  { path: '/templates', label: '模板管理', icon: <FileText size={20} /> },
  { path: '/export', label: '导出工作流', icon: <Download size={20} /> },
]

/**
 * 主布局组件
 * 包含顶部导航栏、侧边栏和主内容区域
 */
function Layout({ children }: LayoutProps) {
  const location = useLocation()
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-primary-600 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                n8n工作流自动生成工具
              </h1>
            </div>
            
            <nav className="hidden md:flex space-x-8">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </header>
      
      {/* 移动端导航菜单 */}
      <nav className="md:hidden bg-white border-b">
        <div className="px-4 py-2">
          <div className="flex space-x-4 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
      
      {/* 主内容区域 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

export default Layout