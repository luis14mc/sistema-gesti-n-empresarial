# 📁 Estructura de Componentes

Esta carpeta contiene todos los componentes React organizados por módulo.

## 📂 Organización

### `/ui` - Componentes UI Base
Componentes reutilizables de interfaz de usuario:
- Button, Input, Card, Badge
- Modal, Table, Spinner, Alert, Select
- EmptyState, ErrorState, LoadingState

### `/layout` - Componentes de Layout
Componentes de estructura y navegación:
- MainLayout, Sidebar, Navbar, Breadcrumb

### `/auth` - Componentes de Autenticación
- LoginForm, RegisterForm

### `/dashboard` - Componentes del Dashboard
- StatsCard, Charts, QuickActions
- RecentTickets, RecentOficios

### `/tickets` - Módulo de Tickets
Componentes para gestión de tickets de soporte

### `/oficios` - Módulo de Oficios
Componentes para gestión de oficios

### `/time-entries` - Módulo de Asistencia
Componentes para marcado de reloj y asistencia

### `/inventory` - Módulo de Inventario Promocional
Componentes para gestión de inventario promocional

### `/equipment` - Módulo de Equipos
Componentes para gestión de equipos tecnológicos

### `/reports` - Módulo de Reportes
Componentes para reportes y analytics

### `/profile` - Componentes de Perfil
Componentes para perfil de usuario y configuración

## 🎨 Convenciones

- Todos los componentes deben ser funcionales (function components)
- Usar TypeScript para tipado estricto
- Exportar por defecto el componente principal
- Usar 'use client' cuando sea necesario (componentes con estado/efectos)
- Props bien documentadas con interfaces TypeScript
- Nombres descriptivos en PascalCase

## 📝 Ejemplo de Componente

```typescript
// components/ui/Button.tsx
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

export default function Button({ children, variant = 'primary', onClick }: ButtonProps) {
  return (
    <button onClick={onClick}>
      {children}
    </button>
  );
}
```
