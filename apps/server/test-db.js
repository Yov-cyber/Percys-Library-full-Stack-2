const { Client } = require('pg');
const client = new Client({
  connectionString: "postgresql://postgres:SeTKGq9dWXCAdH5a@db.hzsqlkbrswwdxndlswph.supabase.co:5432/postgres",
});

async function test() {
  try {
    console.log("Connecting...");
    await client.connect();
    console.log("Connected!");
    const res = await client.query('SELECT NOW()');
    console.log("Success:", res.rows[0]);
    await client.end();
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}

test();
