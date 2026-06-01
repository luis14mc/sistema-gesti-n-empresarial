# Guía de Ramas Git

## 1. Objetivo
Unificar el flujo de control de versiones y evitar conflictos destructivos dentro del repositorio principal de código.

## 2. Estrategia Principal
El proyecto usa un modelo de **Git Flow Simplificado** adaptado a los requisitos de CI/CD modernos.

### 2.1 Ramas Protegidas
*Estas ramas están bloqueadas y no aceptan "Push" directo. Todos los cambios deben entrar mediante Pull Request (PR).*

- **`main`:** Refleja con total exactitud el código desplegado en el entorno de Producción.
- **`develop`:** Rama de integración continua. Refleja el estado del próximo lanzamiento planeado (entorno Staging).

### 2.2 Ramas Efímeras
*Ramas creadas a partir de `develop` para propósitos específicos y eliminadas tras su integración.*

- **`feature/<nombre>`:** Para desarrollar nuevas funciones (ej. `feature/modulo-compras`).
- **`fix/<nombre>`:** Para corregir errores en desarrollo (ej. `fix/error-login-vacio`).
- **`docs/<nombre>`:** Exclusivamente para actualizaciones de documentación ISO.
- **`hotfix/<nombre>`:** (EXCEPCIÓN) Creada directamente desde `main` para resolver caídas catastróficas en Producción.

## 3. Proceso de Integración Continua
1. El programador sube la rama `feature/*` al servidor remoto y crea un Pull Request apuntando hacia `develop`.
2. Las pruebas automatizadas (GitHub Actions / Vitest) se ejecutan.
3. Un revisor aprueba el código.
4. El PR se fusiona (`Squash and Merge` recomendado para historial limpio).
