# Creación Masiva de Usuarios — Playwright

Proyecto de automatización para poblar la base de datos de pruebas mediante creación masiva de usuarios a través del API REST. Genera datos colombianos aleatorios (personas naturales y jurídicas) con validación del dígito de verificación DIAN.

---

## Requisitos previos

| Herramienta | Versión mínima |
|-------------|---------------|
| Node.js     | 18.x          |
| npm         | 9.x           |

---

## Instalación

```bash
npm install
```

---

## Configuración

### 1. URL base del API

Editar `playwright.config.ts`:

```typescript
use: {
  baseURL: 'https://tstviarapida.co:8760',  // <- cambiar aquí
  ...
}
```

### 2. Cantidad de usuarios

Editar `config.ts`:

```typescript
TOTAL_NATURAL: 25,   // Personas naturales (CC) — 10 dígitos, sin dígito de verificación
TOTAL_JURIDICO: 25,  // Personas jurídicas (NIT) — 9 dígitos + dígito de verificación DIAN
```

> Cada usuario genera un vehículo. El total de peticiones al API es `TOTAL_NATURAL + TOTAL_JURIDICO`.

### 3. EPCs

Agregar un EPC por línea en `data/epc-list.txt`:

```
7706113149744687610079635
7706113149744687610079636
7706113149744687610079637
```

Si hay menos EPCs que usuarios, se reutilizan en ciclo. Si el archivo está vacío, el campo `epc` se envía como cadena vacía.

### 4. Otros parámetros (`config.ts`)

| Parámetro       | Descripción                                  | Valor por defecto |
|-----------------|----------------------------------------------|-------------------|
| `ADVISOR_ID`    | ID del asesor asignado a cada usuario        | `1049625159`      |
| `PASSWORD`      | Contraseña para todos los usuarios creados   | `Thoma$2025`      |
| `FISCAL_RESPONS`| Responsabilidad fiscal (código interno)      | `2`               |
| `MIN_VEHICULOS` | Mínimo de vehículos por usuario              | `1`               |
| `MAX_VEHICULOS` | Máximo de vehículos por usuario              | `1`               |

### 5. Formato de placa, como expresión regular (`config.ts`)

```typescript
FORMATOS_PLACA: [
  /^[A-Z]{3}[0-9]{3}$/,   // 3 letras + 3 números, ej. ABC123
  /^[A-Z][0-9]{5}$/,      // 1 letra + 5 números, ej. A12345
],
```

En cada placa se elige al azar uno de los regex de la lista y se genera un string aleatorio que lo cumple (usando [`randexp`](https://www.npmjs.com/package/randexp)). Para forzar un único formato, dejar un solo elemento en el arreglo. Se pueden agregar otros formatos (ej. `/^[A-Z]{2}[0-9]{4}$/`) siempre que el regex describa la placa completa.

### 6. Rango de letra inicial de la placa (`config.ts`)

```typescript
RANGO_LETRA_INICIAL_PLACA: { desde: 'A', hasta: 'D' },  // null = cualquier letra A-Z
```

Todas las placas generadas empezarán por una letra dentro de ese rango (inclusive), sin importar cuál de los `FORMATOS_PLACA` se haya elegido. Para fijar una sola letra, usar `desde` igual a `hasta`, ej. `{ desde: 'B', hasta: 'B' }`. Si el rango es incompatible con todos los formatos configurados (ej. un formato que no admite letra en la primera posición), se lanza un error claro en vez de colgarse.

### 7. Validación de placas únicas contra Oracle

Antes de cada creación se consulta la tabla `TAG` en Oracle; si la placa generada ya existe, se descarta y se genera una nueva (respetando formato y rango de letra configurados) hasta encontrar una libre. Puedes verificar manualmente una placa puntual con `npm run verificar-placa -- ABC123`.

Copiar `.env.example` como `.env` y completar:

```
ORACLE_USER=usuario
ORACLE_PASSWORD=clave
ORACLE_CONNECT_STRING=host:puerto/service_name
```

> `.env` está en `.gitignore` — nunca se debe commitear con credenciales reales.

### 8. Paralelismo

Editar `playwright.config.ts`:

```typescript
workers: 3,  // número de peticiones simultáneas al API
```

> Aumentar `workers` reduce el tiempo total de ejecución. Se recomienda no superar 5 en ambientes de prueba para no saturar el servidor.

---

## Ejecución

```bash
# Correr todos los tests
npm test

# Ver el reporte HTML después de la ejecución
npm run report
```

---

## Reporte

El reporte HTML se genera automáticamente en `playwright-report/`. Cada usuario creado aparece como un test individual con:

- **Estado**: verde (exitoso, incluye HTTP 205) o rojo (fallido)
- **Anotación "Resultado"**: visible junto al título en el listado y en el detalle — `✅ Exitoso`, `⚠️ Parcial (enrolamiento fallido)` o `❌ Fallido (HTTP xxx)`. Nota: el título del test es fijo (nombre/documento) porque Playwright lo necesita para listar los tests antes de ejecutarlos; el resultado se muestra como anotación junto a él, no reemplazándolo.
- **Adjunto Request**: JSON completo enviado al API
- **Adjunto Response**: JSON de respuesta con el código HTTP

Para abrir el reporte manualmente:

```bash
npm run report
```

### Resumen en Markdown

Al finalizar la ejecución, `reporters/resumen-reporter.ts` agrega los resultados de todos los `workers` y genera `reports/resumen-registros_<fecha>_<hora>.md` (ej. `resumen-registros_2026-08-25_15-39-25.md`): una tabla con los datos enviados en cada petición (documento, nombre, email, teléfono, placa, categoría, EPC, etc.), el código HTTP y el resultado (Exitoso / Parcial / Fallido), más los totales. Cada corrida de `npm test` genera un archivo nuevo, no se sobrescribe el de corridas anteriores. Es una carpeta generada (`reports/` está en `.gitignore`).

---

## Datos generados

| Campo        | Persona Natural (CC)              | Persona Jurídica (NIT)               |
|--------------|-----------------------------------|--------------------------------------|
| `identifier` | 10 dígitos, no inicia en 0        | 9 dígitos + dígito verificación DIAN |
| `firstName`  | Nombre de pila                    | Razón social de la empresa           |
| `lastName`   | Apellido                          | *(vacío)*                            |
| `email`      | nombre.apellido@yopmail.com       | razonsocial@yopmail.com              |
| `phone`      | Móvil colombiano (inicia en 3)    | Móvil colombiano (inicia en 3)       |
| `department` | Código DIAN (ej. `05`)            | Código DIAN (ej. `05`)               |
| `locationId` | Código DANE municipio (ej. `05001`) | Código DANE municipio              |
| `plate`      | Formato ABC123                    | Formato ABC123                       |
| `category`   | Entero aleatorio entre 1 y 7      | Entero aleatorio entre 1 y 7         |

---

## Estructura del proyecto

```
├── config.ts                    # Parámetros configurables
├── playwright.config.ts         # URL base, headers, workers, reporter
├── data/
│   └── epc-list.txt            # Lista de EPCs (un EPC por línea)
├── src/
│   ├── utils/
│   │   └── dian.ts             # Algoritmo dígito de verificación DIAN
│   ├── data/
│   │   └── locations.ts        # Catálogo departamentos/municipios Colombia
│   └── generators/
│       └── userGenerator.ts    # Generación de personas y vehículos
└── tests/
    └── crear-usuarios.spec.ts  # Suite principal
```
