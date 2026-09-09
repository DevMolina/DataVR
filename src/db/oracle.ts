import * as dotenv from 'dotenv';
import * as path from 'path';
import oracledb, { Pool } from 'oracledb';
import { servidorActivo } from '../config/servidores';

// Credenciales Oracle específicas del servidor activo (ver
// src/config/servidores.ts → SERVIDOR). Se cargan PRIMERO para que tengan
// prioridad; dotenv no sobreescribe variables ya presentes en process.env,
// así que el .env genérico solo aporta lo que falte (compatibilidad con un
// setup de un único servidor que no haya migrado a .env.vr1/.env.vr2/.env.vr3).
dotenv.config({ path: path.resolve(__dirname, '..', '..', servidorActivo().envFile) });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool: Pool | null = null;

async function getPool(): Promise<Pool> {
  if (!pool) {
    const { ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING } = process.env;
    if (!ORACLE_USER || !ORACLE_PASSWORD || !ORACLE_CONNECT_STRING) {
      throw new Error(
        `Faltan variables de entorno ORACLE_USER, ORACLE_PASSWORD o ORACLE_CONNECT_STRING ` +
        `(ver ${servidorActivo().envFile}.example — servidor activo: ${servidorActivo().nombre})`
      );
    }
    pool = await oracledb.createPool({
      user: ORACLE_USER,
      password: ORACLE_PASSWORD,
      connectString: ORACLE_CONNECT_STRING,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1,
    });
  }
  return pool;
}

// Verifica si ya existe una placa registrada en la tabla TAG.
//
// Se usa TRIM + UPPER en vez de un LIKE directo con el bind porque
// VEHICLELICENCEPLATENUMBER puede ser un CHAR(n) de Oracle: esas columnas se
// rellenan con espacios hasta completar su ancho fijo, y un bind VARCHAR2 sin
// comodines nunca calza contra el valor con relleno, por lo que un LIKE simple
// deja de detectar duplicados que sí existen (falsos negativos silenciosos).
export async function placaExiste(placa: string): Promise<boolean> {
  const p = await getPool();
  const connection = await p.getConnection();
  try {
    const result = await connection.execute<{ VEHICLELICENCEPLATENUMBER: string }>(
      `SELECT t.VEHICLELICENCEPLATENUMBER
         FROM TAG t
        WHERE UPPER(TRIM(t.VEHICLELICENCEPLATENUMBER)) = UPPER(:placa)`,
      { placa },
      { maxRows: 1 }
    );
    return (result.rows?.length ?? 0) > 0;
  } finally {
    await connection.close();
  }
}

// Verifica si ya existe un contacto con ese número de identificación / NIT+DV
// en la tabla CONTACTS (campo USER_ID). Mismo motivo de TRIM+UPPER que en
// placaExiste: la columna puede venir rellenada con espacios (CHAR(n)).
export async function identificadorExiste(identifier: string): Promise<boolean> {
  const p = await getPool();
  const connection = await p.getConnection();
  try {
    const result = await connection.execute<{ USER_ID: string }>(
      `SELECT c.USER_ID
         FROM CONTACTS c
        WHERE UPPER(TRIM(c.USER_ID)) = UPPER(:identifier)`,
      { identifier },
      { maxRows: 1 }
    );
    return (result.rows?.length ?? 0) > 0;
  } finally {
    await connection.close();
  }
}

// Verifica si ya existe un contacto con ese correo en la tabla CONTACTS
// (campo EMAIL).
export async function emailExiste(email: string): Promise<boolean> {
  const p = await getPool();
  const connection = await p.getConnection();
  try {
    const result = await connection.execute<{ EMAIL: string }>(
      `SELECT c.EMAIL
         FROM CONTACTS c
        WHERE UPPER(TRIM(c.EMAIL)) = UPPER(:email)`,
      { email },
      { maxRows: 1 }
    );
    return (result.rows?.length ?? 0) > 0;
  } finally {
    await connection.close();
  }
}

// Trae los EPC disponibles para asignar a vehículos nuevos: EPCs del
// inventario del ministerio que aún no están asociados a ningún tag ya
// registrado (NOT IN contra officevr.tag.EQUIPMENTOBUID). Reemplaza al
// antiguo archivo estático data/epc-list.txt — la lista ahora se toma en
// vivo de Oracle en vez de mantenerse a mano.
export async function obtenerEpcsDisponibles(): Promise<string[]> {
  const p = await getPool();
  const connection = await p.getConnection();
  try {
    const result = await connection.execute<{ EPC_MINISTERIO: string }>(
      `SELECT ttei.EPC_MINISTERIO
         FROM OFFICEVR.TB_TAG_EPC_INVENTARIO ttei
         LEFT JOIN OFFICEVR.TB_DEVICE td ON ttei.EPC_MINISTERIO = td.DEVICE_EPC
        WHERE ttei.tid NOT IN (SELECT t.EQUIPMENTOBUID FROM officevr.tag t)
        ORDER BY ttei.EPC_MINISTERIO DESC`
    );
    return (result.rows ?? [])
      .map((r) => r.EPC_MINISTERIO?.trim())
      .filter((epc): epc is string => Boolean(epc));
  } finally {
    await connection.close();
  }
}

// Resuelve la cuenta (ACCOUNT_ID) asociada a un usuario ya creado, para
// poder enrolarle vehículos adicionales (ver src/enrolamiento/). Un usuario
// puede tener más de una cuenta; por defecto se toma la más antigua
// (ACCOUNT_OPENNING_DATE ascendente).
export async function obtenerCuentaPorIdentificador(identifier: string): Promise<string | null> {
  const p = await getPool();
  const connection = await p.getConnection();
  try {
    const result = await connection.execute<{ ACCOUNT_ID: string }>(
      `SELECT a.ACCOUNT_ID
         FROM TB_ACCOUNT a
        WHERE a.USER_CODE = :user
        ORDER BY a.ACCOUNT_OPENNING_DATE ASC`,
      { user: identifier },
      { maxRows: 1 }
    );
    return result.rows?.[0]?.ACCOUNT_ID ?? null;
  } finally {
    await connection.close();
  }
}

export async function cerrarPoolOracle(): Promise<void> {
  if (pool) {
    await pool.close(10);
    pool = null;
  }
}
