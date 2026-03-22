# aiuiedit

AI-powered visual UI builder with marketplace integration.

## Features

- **Visual Canvas** - Drag-and-drop interface with professional editing tools
- **AI Assistant** - Natural language commands to modify designs
- **Component Library** - 66+ components (6 built-in, expandable)
- **Design System** - Project-specific color palettes and typography
- **Multi-target Export** - React, Vue, Next.js, or plain HTML
- **Keyboard Shortcuts** - Figma-style shortcuts for power users

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build production app
npm run build
```

## AI Commands

Try these natural language commands in the AI chat:
- "Add a button" - Creates a button component
- "Make this green" - Changes background color
- "Move this up 10px" - Nudges element position
- "Update primary color to #FF5733" - Updates design system

## Keyboard Shortcuts

- `Ctrl/Cmd + A` - Select all
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` - Redo
- `Ctrl/Cmd + C` - Copy
- `Ctrl/Cmd + V` - Paste
- `Ctrl/Cmd + D` - Duplicate
- `Delete` - Delete selected
- `Arrow Keys` - Nudge 1px
- `Shift + Arrow` - Nudge 10px

## Architecture

- **Desktop**: Electron 28
- **Frontend**: React 18 + TypeScript 5
- **Build**: Vite 5
- **Styling**: Tailwind CSS
- **State**: Zustand

## Development

Project structure:
```
aiuiedit/
├── electron/          # Main process
├── src/              # React app
│   ├── canvas/      # Canvas engine
│   ├── components/  # UI components
│   ├── core/        # Component registry
│   └── store/       # State management
└── components-lib/  # Built-in components
```

## License

MIT
