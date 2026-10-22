# Guía de Contribución

¡Gracias por tu interés en contribuir al Sistema de Gestión Empresarial! Esta guía establece los estándares para mantener la base de código limpia y segura.

## 1. Flujo de Trabajo Recomendado
1. **Asignación:** Selecciona o créate un *Issue* en GitHub.
2. **Crear Rama:** Crea una rama local desde `develop` siguiendo la convención de nombres.
3. **Desarrollar:** Escribe tu código respetando los estándares de TypeScript estricto.
4. **Validar:** Ejecuta linter y pruebas localmente.
5. **Push & Pull Request:** Envía tus cambios a revisión.

## 2. Convención de Ramas
El proyecto utiliza prefijos estandarizados:
- `feature/nombre-de-la-tarea` (Nuevas funcionalidades)
- `fix/descripcion-del-bug` (Corrección de errores)
- `hotfix/incidencia-critica` (Correcciones urgentes en `main`)
- `docs/nombre-del-documento` (Cambios exclusivamente documentales)

## 3. Convención de Commits
Se emplean **Conventional Commits**:
- `feat:` Una nueva característica.
- `fix:` Corrección de un fallo.
- `docs:` Cambios solo de documentación.
- `style:` Cambios que no afectan el significado del código (espacios, formateo, etc.).
- `refactor:` Un cambio de código que no arregla un fallo ni añade una característica.
- `test:` Añadir pruebas faltantes o corregir pruebas existentes.

*Ejemplo:* `feat(auth): implementar protección contra ataques de fuerza bruta`

## 4. Revisión de Código (Code Review)
- Todo código debe pasar por un *Pull Request* (PR) y ser aprobado por al menos un desarrollador Senior o Arquitecto.
- El PR no debe fusionarse si el pipeline de CI/CD (GitHub Actions) se encuentra en estado fallido.

## 5. Pruebas antes del Merge
Es obligatorio ejecutar los siguientes comandos localmente antes de abrir un PR:
```bash
npm run lint
npx tsc --noEmit
npm run test
```

## 6. Actualización de Documentación
Si se introduce un nuevo servicio o ruta API, el desarrollador **debe** actualizar el modelo de datos, la guía de arquitectura o los requerimientos funcionales dentro del directorio `/docs/`. Ningún *feature* se considera "Terminado" hasta que su documentación lo esté.
