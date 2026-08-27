# Creación Masiva de Usuarios — Playwright

Proyecto con dos partes independientes sobre el mismo endpoint (`POST /settings-users/api/v1/usersCl`):

- **`runner/`** — herramienta de creación masiva de usuarios/vehículos de prueba (personas naturales y jurídicas colombianas, con dígito de verificación DIAN). No es una suite de validación: es un runner que consume el endpoint para poblar datos. Su comportamiento es estable y no cambia al agregar casos de prueba nuevos.
- **`tests/`** — casos de prueba reales del endpoint (formato, límites, positivos y negativos) que evalúan cómo responde el API ante distintos escenarios. Ver [Casos de prueba del endpoint](#casos-de-prueba-del-endpoint).

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

Editar `playwright.use.shared.ts` (compartido por `playwright.config.ts`, para los casos de prueba en `tests/`, y `playwright.runner.config.ts`, para el runner en `runner/` — un solo lugar para cambiar la URL en ambos):

```typescript
export const usoCompartido: PlaywrightTestConfig['use'] = {
  baseURL: 'https://tstviarapida.co:8760',  // <- cambiar aquí
  ...
};
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

Editar `playwright.config.ts` (casos de prueba) y/o `playwright.runner.config.ts` (runner de creación masiva):

```typescript
workers: 3,  // número de peticiones simultáneas al API
```

> Aumentar `workers` reduce el tiempo total de ejecución. Se recomienda no superar 5 en ambientes de prueba para no saturar el servidor.

---

## Ejecución

```bash
# Casos de prueba del endpoint (tests/): validaciones unitarias + límite + negativos
npm test

# Solo una de las tres suites de tests/
npm run test:validaciones
npm run test:positivos
npm run test:negativos

# Runner de creación masiva de datos de prueba (runner/) — acción explícita y separada
npm run test:masivo

# Ver el reporte HTML de la última corrida
npm run report            # de npm test (tests/)
npm run report:masivo     # de npm run test:masivo (runner/)
```

`npm run test:masivo` requiere `.env` con credenciales Oracle (los casos de `tests/` usan Oracle solo en `casos-positivos/`, ya que `casos-negativos/` y `validaciones/` no tocan la base de datos).

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

Los casos de prueba de estas validaciones viven en `tests/validaciones/` (tests unitarios, sin `request` fixture ni conexión a Oracle).

---

## Casos de prueba del endpoint

`tests/casos-negativos/campos-invalidos.spec.ts` envía, por cada campo relevante del body, una variante inválida (ausente, vacía, formato incorrecto, fuera de rango o inconsistente con otro campo — ver `src/testing/mutaciones.ts` → `CASOS_NEGATIVOS`) y compara el HTTP real contra una **línea base medida**, no contra un contrato ideal.

### Por qué "línea base" y no "HTTP esperado de validación"

Al medir el comportamiento real del ambiente de pruebas se encontró que el API **casi no valida el body**:

| Patrón observado | Proporción | Ejemplo |
|---|---|---|
| 400 (validación real) | 2/92 | `locationId` con letras |
| 500 (el servidor cae — bug) | 16/92 | `documentType`, `email`, `firstName`, `identifier`, `personType` ausentes/vacíos en ciertas combinaciones |
| 451 (código no estándar, solo en NIT) | 3/92 | `identifier` ausente/inválido/DV incorrecto |
| 204 (se crea igual, "enrolamiento fallido") | ~65/92 | la mayoría: `address`, `country`, `password`, `phone`, `category` fuera de rango, etc. |
| 200 (éxito total, sin validar nada) | 6/92 | `plate`, `category` y `epc` ausentes |

Como no hay un contrato de validación real que afirmar, cada caso en `CASOS_NEGATIVOS` trae su propio `httpEsperado` (el valor medido) y, cuando ese valor es un 500, `bugConocido: true`. La suite compara contra esa línea base: un test en rojo significa que el comportamiento **cambió** respecto a lo medido (regresión de contrato a revisar), no que el API esté validando mal — eso ya se sabe y queda documentado, no oculto.

Si el equipo del API corrige la validación de un campo, actualiza el `httpEsperado` correspondiente en `src/testing/mutaciones.ts` para que la suite refleje el nuevo comportamiento esperado.

`tests/casos-positivos/campos-limite.spec.ts` complementa con valores límite/equivalencia que sí deben ser aceptados (`category` en 1 y 7, `optionalPhone` con un valor real en vez de `null`) — reutiliza los mismos helpers de unicidad contra Oracle que el runner (`src/testing/registroHelpers.ts`), porque estos casos sí crean registros reales.

### Reporte

Además del reporte HTML estándar de Playwright, `reporters/resumen-reporter.ts` genera `reports/casos-validacion_<fecha>.md`: una tabla con cada campo/caso, el HTTP de línea base, el HTTP real, si es un bug conocido y si coincidió con la línea base.

### Extender la cobertura

Para agregar un caso nuevo: añadir una entrada a `CASOS_NEGATIVOS` (o `CASOS_POSITIVOS_LIMITE`) en `src/testing/mutaciones.ts` con su `httpEsperado` — se recomienda correr `npm run test:negativos` una vez para medir el comportamiento real del campo antes de fijar ese valor, en vez de asumirlo.

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
├── config.ts                    # Parámetros configurables del runner de creación masiva
├── playwright.config.ts         # Config de tests/ (casos de prueba del endpoint)
├── playwright.runner.config.ts  # Config de runner/ (creación masiva)
├── playwright.use.shared.ts     # baseURL/headers compartidos por ambos configs
├── data/
│   └── epc-list.txt            # Lista de EPCs (un EPC por línea)
├── scripts/
│   ├── verificar-placa.ts      # Diagnóstico manual: placa en TAG
│   └── verificar-contacto.ts   # Diagnóstico manual: identificador/email en CONTACTS
├── reporters/
│   └── resumen-reporter.ts     # Resumen agregado + tablas Markdown al finalizar
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
│   ├── testing/
│   │   ├── httpCodes.ts        # Constantes/labels de códigos HTTP del endpoint
│   │   ├── registroHelpers.ts  # Unicidad Oracle + validación de formato (runner y casos-positivos)
│   │   └── mutaciones.ts       # Catálogo de casos negativos/positivos con su línea base HTTP
│   └── generators/
│       └── userGenerator.ts    # Generación de personas y vehículos
├── runner/
│   └── crear-usuarios.spec.ts  # Herramienta de creación masiva (npm run test:masivo)
└── tests/
    ├── validaciones/           # Tests unitarios de src/validators/ (sin API ni Oracle)
    │   ├── identificador.spec.ts
    │   └── email.spec.ts
    ├── casos-negativos/
    │   └── campos-invalidos.spec.ts   # Body inválido por campo vs. línea base medida
    └── casos-positivos/
        └── campos-limite.spec.ts      # Valores límite/equivalencia que deben aceptarse
```
