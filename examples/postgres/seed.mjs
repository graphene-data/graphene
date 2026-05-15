import process from 'node:process'
import pg from 'pg'

let client = new pg.Client({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  host: process.env.PGHOST || process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432),
  database: process.env.PGDATABASE || process.env.POSTGRES_DATABASE || 'graphene',
  user: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
})

await client.connect()
await client.query(`
  drop table if exists order_items;
  drop table if exists orders;
  drop table if exists customers;

  create table customers (
    id integer primary key,
    name text not null,
    region text not null,
    signup_date date not null,
    tags text[] not null
  );

  create table orders (
    id integer primary key,
    customer_id integer not null references customers(id),
    order_date timestamp not null,
    status text not null,
    total numeric(12, 2) not null
  );

  create table order_items (
    id integer primary key,
    order_id integer not null references orders(id),
    sku text not null,
    quantity integer not null,
    unit_price numeric(12, 2) not null
  );

  insert into customers (id, name, region, signup_date, tags) values
    (1, 'Acme Supply', 'West', '2024-01-02', array['enterprise', 'priority']),
    (2, 'Beacon Retail', 'East', '2024-01-12', array['retail']),
    (3, 'Cobalt Labs', 'West', '2024-02-05', array['startup', 'priority']),
    (4, 'Delta Foods', 'South', '2024-02-20', array['retail', 'food']);

  insert into orders (id, customer_id, order_date, status, total) values
    (100, 1, '2024-03-01 10:15:00', 'completed', 120.50),
    (101, 1, '2024-03-08 12:00:00', 'completed', 89.99),
    (102, 2, '2024-03-09 09:30:00', 'pending', 45.00),
    (103, 3, '2024-03-14 14:45:00', 'completed', 220.00),
    (104, 4, '2024-03-20 16:20:00', 'cancelled', 35.25),
    (105, 2, '2024-03-21 11:10:00', 'completed', 175.75);

  insert into order_items (id, order_id, sku, quantity, unit_price) values
    (1000, 100, 'ANVIL', 2, 45.00),
    (1001, 100, 'BOLT', 5, 6.10),
    (1002, 101, 'ANVIL', 1, 89.99),
    (1003, 102, 'CABLE', 3, 15.00),
    (1004, 103, 'DRILL', 2, 110.00),
    (1005, 104, 'BOLT', 5, 7.05),
    (1006, 105, 'CABLE', 5, 20.00),
    (1007, 105, 'DRILL', 1, 75.75);
`)
await client.end()
