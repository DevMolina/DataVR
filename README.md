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

### 5. Rango de letra inicial de la placa (`config.ts`)

```typescript
RANGO_LETRA_INICIAL_PLACA: { desde: 'A', hasta: 'D' },  // null = cualquier letra A-Z
```

Todas las placas generadas empezarán por una letra dentro de ese rango (inclusive). Para fijar una sola letra, usar `desde` igual a `hasta`, ej. `{ desde: 'B', hasta: 'B' }`.

### 6. Validación de placas únicas contra Oracle

Antes de cada creación se consulta la tabla `TAG` en Oracle; si la placa generada ya existe, se descarta y se genera una nueva (respetando el rango de letra configurado) hasta encontrar una libre.

Copiar `.env.example` como `.env` y completar:

```
ORACLE_USER=usuario
ORACLE_PASSWORD=clave
ORACLE_CONNECT_STRING=host:puerto/service_name
```

> `.env` está en `.gitignore` — nunca se debe commitear con credenciales reales.

### 7. Paralelismo

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

- **Estado**: verde (exitoso) o rojo (fallido)
- **Adjunto Request**: JSON completo enviado al API
- **Adjunto Response**: JSON de respuesta con el código HTTP

Para abrir el reporte manualmente:

```bash
npm run report
```

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
