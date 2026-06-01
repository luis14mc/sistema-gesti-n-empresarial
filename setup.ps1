# Script de Inicio Rápido - Sistema de Gestión Empresarial
# Este script configura y ejecuta el proyecto automáticamente

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Sistema de Gestión Empresarial - Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si existe Node.js
Write-Host "Verificando Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js no está instalado. Por favor instálalo desde https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js instalado: $nodeVersion" -ForegroundColor Green

# Verificar si existe el archivo .env
if (-Not (Test-Path ".env")) {
    Write-Host ""
    Write-Host "⚙️ Configurando archivo .env..." -ForegroundColor Yellow
    
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✅ Archivo .env creado desde .env.example" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️ IMPORTANTE: Por favor edita el archivo .env con tus credenciales de PostgreSQL" -ForegroundColor Yellow
        Write-Host "   DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/gestion_empresarial?schema=public" -ForegroundColor White
        Write-Host ""
        
        $continue = Read-Host "¿Deseas continuar? (Y/N)"
        if ($continue -ne "Y" -and $continue -ne "y") {
            Write-Host "Setup cancelado. Configura el .env y vuelve a ejecutar este script." -ForegroundColor Yellow
            exit 0
        }
    } else {
        Write-Host "❌ No se encontró .env.example" -ForegroundColor Red
        exit 1
    }
}

# Verificar si existen node_modules
if (-Not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "📦 Instalando dependencias..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error al instalar dependencias" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Dependencias instaladas" -ForegroundColor Green
}

# Generar Prisma Client
Write-Host ""
Write-Host "🔧 Generando Prisma Client..." -ForegroundColor Yellow
npm run prisma:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al generar Prisma Client" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Prisma Client generado" -ForegroundColor Green

# Preguntar si desea configurar la base de datos
Write-Host ""
$setupDB = Read-Host "¿Deseas configurar la base de datos ahora? (Y/N)"
if ($setupDB -eq "Y" -or $setupDB -eq "y") {
    Write-Host ""
    Write-Host "🗄️ Configurando base de datos..." -ForegroundColor Yellow
    
    # Push schema
    Write-Host "Creando tablas..." -ForegroundColor Yellow
    npm run prisma:push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error al crear tablas. Verifica tu conexión a PostgreSQL" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Tablas creadas" -ForegroundColor Green
    
    # Seed
    Write-Host ""
    Write-Host "Poblando base de datos con datos de ejemplo..." -ForegroundColor Yellow
    npm run prisma:seed
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error al poblar base de datos" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Base de datos poblada" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "  Credenciales de acceso:" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "Admin:      admin@empresa.com / password123" -ForegroundColor White
    Write-Host "Manager:    manager@empresa.com / password123" -ForegroundColor White
    Write-Host "Técnico:    tech@empresa.com / password123" -ForegroundColor White
    Write-Host "Secretaria: secretary@empresa.com / password123" -ForegroundColor White
    Write-Host "Usuario 1:  juan@empresa.com / password123" -ForegroundColor White
    Write-Host "Usuario 2:  lucia@empresa.com / password123" -ForegroundColor White
    Write-Host "================================================" -ForegroundColor Cyan
}

# Preguntar si desea iniciar el servidor
Write-Host ""
$startServer = Read-Host "¿Deseas iniciar el servidor de desarrollo? (Y/N)"
if ($startServer -eq "Y" -or $startServer -eq "y") {
    Write-Host ""
    Write-Host "🚀 Iniciando servidor de desarrollo..." -ForegroundColor Green
    Write-Host "   La aplicación estará disponible en: http://localhost:3000" -ForegroundColor White
    Write-Host ""
    Write-Host "   Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
    Write-Host ""
    
    npm run dev
} else {
    Write-Host ""
    Write-Host "✅ Setup completado exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Para iniciar el servidor, ejecuta:" -ForegroundColor White
    Write-Host "   npm run dev" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Otros comandos útiles:" -ForegroundColor White
    Write-Host "   npm run prisma:studio  - Abrir Prisma Studio (GUI de BD)" -ForegroundColor Cyan
    Write-Host "   npm run build          - Construir para producción" -ForegroundColor Cyan
    Write-Host "   npm run lint           - Ejecutar linter" -ForegroundColor Cyan
    Write-Host ""
}
