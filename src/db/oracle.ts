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
export async function placaExiste(placa: string): Promise<boolean> {
  const p = await getPool();
  const connection = await p.getConnection();
  try {
    const result = await connection.execute<{ VEHICLELICENCEPLATENUMBER: string }>(
      `SELECT t.VEHICLELICENCEPLATENUMBER FROM TAG t WHERE t.VEHICLELICENCEPLATENUMBER LIKE :placa`,
      { placa },
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
