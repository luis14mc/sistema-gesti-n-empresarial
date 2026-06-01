# Checklist de Puesta en Producción

## Infraestructura y Servidor
- [ ] Versión correcta de Node.js instalada en el servidor destino.
- [ ] Clave `JWT_SECRET` generada criptográficamente (al menos 32 caracteres) y distinta a la de Desarrollo.
- [ ] Variables de entorno no exponen secretos en la UI (sin prefijo `NEXT_PUBLIC_`).

## Base de Datos
- [ ] Respaldo de seguridad ejecutado antes de la actualización (Backup completo).
- [ ] Script de migración de esquema de Prisma fue probado exitosamente en entorno Staging.
- [ ] Clúster de PostgreSQL tiene recursos escalados acorde al requerimiento (Capacidad/Conexiones máximas configuradas en Prisma).

## Código y Seguridad
- [ ] Ejecución de `npm audit` exitosa (sin vulnerabilidades críticas).
- [ ] Compilación (`npm run build`) ejecutada sin advertencias de linters.
- [ ] `NODE_ENV` está establecido forzosamente en `production`.

## Final
- [ ] Validación de la URL pública. HTTPS configurado y respondiendo con un certificado SSL válido.
