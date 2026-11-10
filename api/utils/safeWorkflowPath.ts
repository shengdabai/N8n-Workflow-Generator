import path from 'node:path'
import fs from 'node:fs/promises'

export async function safeWorkflowPath(directory: string, filename: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_\u4e00-\u9fa5][A-Za-z0-9._\u4e00-\u9fa5-]*\.json$/u.test(filename)) return null
  try {
    const base = await fs.realpath(directory)
    const target = await fs.realpath(path.join(base, filename))
    if (path.dirname(target) !== base || !(await fs.stat(target)).isFile()) return null
    return target
  } catch {
    return null
  }
}
