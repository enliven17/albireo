-- Up Migration
CREATE TABLE lab_hist_stream (
  id text PRIMARY KEY,
  ending numeric(30,0) NOT NULL,
  count bigint NOT NULL,
  total_sum double precision NOT NULL,
  buckets jsonb NOT NULL,
  bounds jsonb NOT NULL
);
CREATE TABLE lab_hist_receipt (id text PRIMARY KEY, fingerprint text NOT NULL);
CREATE TABLE lab_hist_rollup (
  tenant text NOT NULL,
  layout text NOT NULL,
  count bigint NOT NULL,
  total_sum double precision NOT NULL,
  buckets jsonb NOT NULL,
  PRIMARY KEY (tenant,layout)
);

-- Down Migration
DROP TABLE lab_hist_receipt, lab_hist_stream, lab_hist_rollup;
