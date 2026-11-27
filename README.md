This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## SQLite y copias de seguridad

- En desarrollo, `DATABASE_URL="file:./dev.db"` usa `prisma/dev.db`.
- Para preparar una instalación nueva, ejecuta `npm run db:setup` en desarrollo o `npm run db:setup:production` en el equipo del cliente antes de iniciar la aplicación. La semilla solo se aplica si la base no contiene categorías.
- En producción, Windows guarda la base fuera del repositorio en `%ProgramData%\MiniInventario`. En macOS y Linux usa la carpeta de datos local del usuario. `MINI_INVENTARIO_DATA_DIR` permite definir otra ruta.
- Las copias se crean de forma consistente con SQLite en la carpeta `backups` junto a la base; se conservan 30 días por defecto. `MINI_INVENTARIO_BACKUP_RETENTION_DAYS` permite cambiar el plazo.
- Ejecuta `npm run db:backup` para una copia manual. En Windows, `npm run db:backup:install` registra la tarea diaria a las 02:00 para el usuario actual.
- Para restaurar, detén la aplicación, conserva una copia del archivo actual y reemplázalo con la copia elegida antes de iniciar de nuevo.

## Acceso, usuarios y permisos

- En una instalación sin usuarios, abre la aplicación y crea la primera cuenta administradora desde la pantalla de configuración. Solo es posible completar este paso una vez.
- El administrador puede crear usuarios, asignarles roles y definir permisos desde **Usuarios y roles**. Las contraseñas deben tener al menos 12 caracteres.
- Las sesiones duran 12 horas y se almacenan en una cookie `HttpOnly`; las operaciones también verifican permisos en el servidor.
- Para instalaciones ya existentes, ejecuta `npm run db:setup` antes de iniciar la aplicación. Además de aplicar migraciones pendientes, el ajuste de inventario asigna al mostrador únicamente los productos con stock total y sin ninguna existencia registrada por ubicación; registra esa asignación como movimiento de apertura. Haz una copia de seguridad antes de actualizar.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
