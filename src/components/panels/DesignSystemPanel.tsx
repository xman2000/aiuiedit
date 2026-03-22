import { Palette } from 'lucide-react'

export function DesignSystemPanel() {
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2 text-muted-foreground">
        <Palette className="h-4 w-4" />
        <span className="text-sm font-medium">Design System</span>
      </div>
      
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Colors
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'].map((color) => (
              <div
                key={color}
                className="h-8 rounded-md cursor-pointer hover:ring-2 ring-primary"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Typography
          </h3>
          <div className="space-y-2 text-sm">
            <div className="rounded border p-2">Inter</div>
          </div>
        </div>
      </div>
    </div>
  )
}
