# Plan Maestro — Refactorización SGE

Sistema de Gestión Empresarial: migración a shadcn/ui + Sileo + SweetAlert2 con colores institucionales, dark/light mode, RBAC dinámico.

---

## 🧹 Fase 0: Limpieza Profunda
Eliminación de componentes UI antiguos y limpieza de boilerplate para iniciar con una arquitectura limpia basada en shadcn/ui.

## 🛠️ Fase 1: Configuración Base
- shadcn/ui inicializado.
- Sileo y SweetAlert2 instalados.
- Tipografía Montserrat configurada.

## 🎨 Fase 2: Diseño Frontend
- Paleta institucional (#25A966, #35A8E0, #252A58).
- Soporte Dark/Light mode con CSS variables.
- ThemeToggle con persistencia en localStorage.

## 🔒 Fase 3: RBAC Dinámico
- Matriz de permisos (5 roles × 9 módulos).
- Sidebar y acciones protegidas por permisos.
- Validación de rol en API y UI.

## ⚙️ Fase 4: Módulos Frontend
- Componentes base: `PageHeader`, `StatsCard`, `DataTable`.
- Páginas migradas: Dashboard, Tickets, Oficios, Equipos, Inventario, Asistencia, Configuración.

---

## Estado Actual
- ✅ TSC check: 0 errores.
- ✅ Todas las pantallas principales funcionales (12 páginas).
- ✅ Dark mode unificado.
- ✅ CRUD de Usuarios completo (API + service + hook + page).
- ✅ Asignaciones de Equipos completa.
- 🕒 Pendiente: Verificación visual (`npm run dev`) + Responsive audit.
