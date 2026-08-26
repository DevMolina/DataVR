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

### 7. Validación contra Oracle antes de enviar la petición

Antes de cada creación se valida, contra la base de datos, que los datos generados no colisionen con registros ya existentes:

- **Placa**: se consulta la tabla `TAG` (campo `VEHICLELICENCEPLATENUMBER`); si la placa generada ya existe, se descarta y se genera una nueva (respetando formato y rango de letra configurados) hasta encontrar una libre. Verificación manual: `npm run verificar-placa -- ABC123`.
- **Identificador y email**: se consulta la tabla `CONTACTS` (campos `USER_ID` y `EMAIL`); si el número de identificación / NIT+DV o el correo generados ya existen, se regenera solo el campo afectado (identificador o email, no todo el registro) hasta obtener valores libres. Verificación manual: `npm run verificar-contacto -- --id 1234567890` o `npm run verificar-contacto -- --email nombre@yopmail.com`.

Adicionalmente, antes de enviar cualquier petición se valida el **formato** del identificador (dígitos, no inicia en 0, dígito de verificación DIAN correcto para NIT) y del email (`src/validators/`). Esto es una verificación defensiva: el generador ya produce datos con formato correcto, pero la validación explícita detecta regresiones sin depender de la respuesta del API.

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

El servicio de registro de usuarios responde con uno de estos códigos HTTP:

| HTTP | Significado                                      | ¿Hace fallar el test? |
|------|---------------------------------------------------|------------------------|
| 200  | Registro y enrolamiento exitosos                  | No                     |
| 204  | Registro exitoso, pero el enrolamiento falló       | No (resultado parcial) |
| 205  | Falló la creación del usuario                      | Sí                     |

El reporte HTML se genera automáticamente en `playwright-report/`. Cada usuario creado aparece como un test individual con:

- **Estado**: verde (exitoso, incluye HTTP 204) o rojo (fallido, HTTP 205 u otro código)
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

## Validación de datos (`src/validators/`)

Módulo separado de los generadores (`src/generators/`) y de las consultas a BD (`src/db/`), pensado para poder probarse de forma unitaria sin depender del API ni de Oracle:

- `src/validators/identificador.ts`: valida el **formato** de cédulas (CC) y de NIT+DV (recalcula el dígito de verificación DIAN y lo compara).
- `src/validators/email.ts`: valida el **formato** de un correo electrónico.

Estas validaciones de formato son independientes de las de unicidad contra BD (`identificadorExiste` / `emailExiste` / `placaExiste` en `src/db/oracle.ts`): las primeras determinan si el dato *tiene forma válida*, las segundas si *ya existe* en `CONTACTS` o `TAG`.

Los casos de prueba de estas validaciones viven en `tests/validaciones/` (tests unitarios, sin `request` fixture ni conexión a Oracle) — es el punto de partida para agregar más casos de prueba de validación a futuro.

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
├── scripts/
│   ├── verificar-placa.ts      # Diagnóstico manual: placa en TAG
│   └── verificar-contacto.ts   # Diagnóstico manual: identificador/email en CONTACTS
├── reporters/
│   └── resumen-reporter.ts     # Resumen agregado + tabla Markdown al finalizar
├── src/
│   ├── utils/
│   │   └── dian.ts             # Algoritmo dígito de verificación DIAN
│   ├── data/
│   │   └── locations.ts        # Catálogo departamentos/municipios Colombia
│   ├── db/
│   │   └── oracle.ts           # Consultas de UNICIDAD contra Oracle (TAG, CONTACTS)
│   ├── validators/
│   │   ├── identificador.ts    # Validación de FORMATO: cédula, NIT+DV
│   │   └── email.ts            # Validación de FORMATO: email
│   └── generators/
│       └── userGenerator.ts    # Generación de personas y vehículos
└── tests/
    ├── crear-usuarios.spec.ts  # Suite principal (creación masiva vía API)
    └── validaciones/           # Tests unitarios de src/validators/ (sin API ni Oracle)
        ├── identificador.spec.ts
        └── email.spec.ts
```
