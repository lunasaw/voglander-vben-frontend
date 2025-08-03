# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
# Start interactive dev server selection
pnpm dev

# Start specific applications
pnpm dev:antd          # Ant Design Vue version (primary development target)
pnpm dev:ele           # Element Plus version
pnpm dev:naive         # Naive UI version
pnpm dev:docs          # Documentation site
pnpm dev:play          # Playground for testing
```

### Building
```bash
# Build all applications
pnpm build

# Build specific applications
pnpm build:antd        # Primary target - Ant Design version
pnpm build:ele         # Element Plus version
pnpm build:naive       # Naive UI version
pnpm build:analyze     # Build with bundle analysis

# Docker build
pnpm build:docker
```

### Code Quality
```bash
# Run all quality checks
pnpm check

# Individual checks
pnpm check:type        # TypeScript type checking
pnpm check:dep         # Dependency validation
pnpm check:circular    # Circular dependency detection
pnpm check:cspell      # Spell checking

# Linting and formatting
pnpm lint              # Run linting
pnpm format            # Format code
```

### Testing
```bash
# Unit tests
pnpm test:unit

# E2E tests
pnpm test:e2e          # Run Playwright tests
pnpm test:e2e-ui       # Interactive UI mode
pnpm test:e2e-codegen  # Generate tests
```

### Package Management
```bash
# Clean and reinstall
pnpm reinstall

# Update dependencies
pnpm update:deps

# Check for unused dependencies
pnpm check:dep
```

## Architecture Overview

### Monorepo Structure
This is a **pnpm workspace monorepo** with **Turborepo** orchestration:

- **`/apps/`** - Three web applications with different UI frameworks:
  - `web-antd/` - **Primary development target** (Ant Design Vue)
  - `web-ele/` - Element Plus version
  - `web-naive/` - Naive UI version
- **`/packages/`** - Shared libraries organized by domain
- **`/internal/`** - Development tooling and configurations
- **`/playground/`** - **Style and component reference** for development
- **`/docs/`** - VitePress documentation

### Key Development Rules

**Primary Development Location**: All new development work happens in `apps/web-antd/`

**Style and Pattern Reference**: `playground/src/views/` contains the authoritative examples for:
- Component usage patterns
- UI/UX design standards
- Layout structures
- Interactive behaviors

**API Integration**: All APIs defined in `apps/web-antd/api/Voglander.openapi.json`

### Technology Stack
- **Frontend**: Vue 3 + TypeScript + Composition API
- **UI Framework**: Ant Design Vue (primary), Element Plus, Naive UI
- **Build Tool**: Vite with custom plugin system
- **Routing**: Vue Router 4 with backend-driven permissions
- **State Management**: Pinia with persistence and encryption
- **Styling**: Tailwind CSS + CSS custom properties
- **Tables**: VXE Table for complex data grids
- **Forms**: Dynamic schema-based forms with validation
- **Icons**: Unified `@vben/icons` system (Lucide icons)

### Package Organization
```
packages/
├── @core/               # Core framework
│   ├── base/           # Foundation utilities
│   ├── composables/    # Vue composables
│   ├── preferences/    # User preferences
│   └── ui-kit/         # Shared UI components
├── effects/            # Feature packages
│   ├── access/         # Permission control
│   ├── common-ui/      # Common UI components
│   ├── request/        # HTTP client
│   └── layouts/        # Layout components
└── [business]/         # Domain-specific packages
    ├── icons/          # Unified icon system
    ├── locales/        # Internationalization
    ├── stores/         # State management
    └── utils/          # Utilities
```

## Development Patterns

### Component Development
1. **Reference First**: Always check `playground/src/views/examples/` for existing patterns
2. **VXE Table**: Use for data grids with proper scroll configuration:
   ```typescript
   scrollX: { enabled: true },
   scrollY: { enabled: true }
   ```
3. **Forms**: Use schema-based dynamic forms from `@vben/common-ui`
4. **Modals/Drawers**: Follow patterns in playground examples

### Icon Usage
- **Only use**: `@vben/icons` (Lucide-based)
- **Never use**: `@ant-design/icons-vue`, `@iconify/vue`, etc.
- **Import pattern**: `import { Search, Plus, Settings } from '@vben/icons'`
- **Available icons**: Check `packages/@core/base/icons/src/lucide.ts`

### Permission Control
Implement **dual permission protection**:
```typescript
// 1. Button visibility control
{
  code: 'edit',
  show: () => hasAccessByCodes(['Module:Entity:Edit']),
}

// 2. Action-time validation
function onEdit(row: any) {
  if (!hasAccessByCodes(['Module:Entity:Edit'])) {
    message.error('您没有编辑权限');
    return;
  }
  // Execute edit logic
}
```

### State Management Patterns
- **Status toggles**: Use `CellSwitch` renderer for direct state changes
- **Confirmation dialogs**: Always confirm destructive actions
- **Error handling**: Consistent error messages and user feedback
- **Loading states**: Use message.loading for async operations

### API Integration
- **Base URL**: Configurable via environment variables
- **Authentication**: Bearer token with automatic refresh
- **Error handling**: Centralized with user-friendly messages
- **Type safety**: Full TypeScript interfaces for all responses
- **Time format**: Backend sends timestamps (milliseconds), frontend handles timezone conversion

### Internationalization
- **Framework**: Vue I18n with dynamic loading
- **Structure**: Modular JSON files by feature area
- **Naming**: `module.entity.action` pattern (e.g., `system.user.edit`)
- **Required**: All user-facing text must be internationalized
- **Location**: `apps/web-antd/src/locales/langs/`

## File Structure Conventions

### Page Organization
```
apps/web-antd/src/views/[module]/[entity]/
├── list.vue           # Main list/table page
├── detail.vue         # Detail/view page (if needed)
├── data.ts           # Column definitions, schemas, utilities
└── modules/
    └── form.vue      # Create/edit form component
```

### API Organization
```
apps/web-antd/src/api/[module]/
├── [entity].ts       # Entity-specific API calls
└── types.ts          # TypeScript interfaces
```

### Route Organization
```
apps/web-antd/src/router/routes/modules/
├── [module].ts       # Module route definitions
```

## Configuration Files

### Environment Variables
- **Development**: API proxy to `http://0.0.0.0:8081`
- **Security**: Encryption keys for store persistence
- **Features**: Toggle dev tools, analysis, etc.

### Build Configuration
- **Vite**: Custom plugin system in `/internal/vite-config/`
- **TypeScript**: Shared configs in `/internal/tsconfig/`
- **Tailwind**: Shared config in `/internal/tailwind-config/`

### Quality Tools
- **ESLint**: Vue 3 + TypeScript rules with auto-fixing
- **Prettier**: Integrated with Tailwind class sorting
- **Stylelint**: SCSS support with Recess ordering
- **Commitlint**: Conventional commits required

## Testing Approach

### Unit Testing
- **Framework**: Vitest with Happy DOM
- **Location**: Colocated `*.test.ts` files
- **Coverage**: Integrated reporting

### E2E Testing
- **Framework**: Playwright
- **Location**: `/playground/__tests__/e2e/`
- **Browsers**: Chromium primary, cross-browser support

## Common Development Workflows

### Creating a New Management Page
1. Check OpenAPI definition in `apps/web-antd/api/Voglander.openapi.json`
2. Find similar pattern in `playground/src/views/examples/`
3. Create page structure in `apps/web-antd/src/views/[module]/[entity]/`
4. Implement API layer in `apps/web-antd/src/api/[module]/`
5. Add route definition in `apps/web-antd/src/router/routes/modules/`
6. Create internationalization files
7. Generate SQL for database menu records (reference `apps/web-antd/sql/menu-data-insert.sql`)

### Adding a New Feature
1. **Plan**: Check existing patterns in playground
2. **Implement**: Follow established conventions
3. **Test**: Run type checking and unit tests
4. **Lint**: Ensure code quality standards
5. **Document**: Update internationalization files

### Working with Tables
- Use VXE Table for complex data grids
- Configure scroll options for wide tables
- Implement proper column width settings
- Use fixed columns for actions (`fixed: 'right'`)
- Follow permission patterns for action buttons

### Git Workflow
- **Conventional commits**: Required via commitlint
- **Pre-commit hooks**: Automatic linting and formatting
- **Branch naming**: Follow conventional patterns
- **Code quality**: All checks must pass before commit