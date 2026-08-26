import 'dotenv/config';
import oracledb, { Pool } from 'oracledb';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool: Pool | null = null;

async function getPool(): Promise<Pool> {
  if (!pool) {
    const { ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING } = process.env;
    if (!ORACLE_USER || !ORACLE_PASSWORD || !ORACLE_CONNECT_STRING) {
      throw new Error(
        'Faltan variables de entorno ORACLE_USER, ORACLE_PASSWORD o ORACLE_CONNECT_STRING (ver .env.example)'
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

export async function cerrarPoolOracle(): Promise<void> {
  if (pool) {
    await pool.close(10);
    pool = null;
  }
}
