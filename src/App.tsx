import { Routes, Route } from "react-router-dom";
import HomePage from "@/pages/HomePage";
// 新增路由页面组件导入
import EditorPage from "@/pages/EditorPage";
import ExportPage from "@/pages/ExportPage";
import TemplatesPage from "@/pages/TemplatesPage";
import EnhancedGenerator from "@/pages/EnhancedGenerator";

export default function App() {
  return (
    // 移除重复的 <Router> 包裹，避免嵌套 Router 错误
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/enhanced" element={<EnhancedGenerator />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/export" element={<ExportPage />} />
      <Route path="/templates" element={<TemplatesPage />} />
      <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
    </Routes>
  );
}