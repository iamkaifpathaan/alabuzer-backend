/**
 * Migration: Fix phone_1 index to be sparse and remove users with phone: null
 *
 * Run once after deploying the schema fix:
 *   node scripts/fix-phone-index.js
 *
 * What this script does:
 *  1. Removes users that have phone explicitly set to null (legacy bad data).
 *  2. Drops the old phone_1 index (which may be non-sparse).
 *  3. Recreates it as a unique sparse index so multiple users without a
 *     phone number can coexist without triggering E11000 duplicate key errors.
 */

"use strict";

require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("ERROR: MONGO_URI environment variable is not set.");
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;
  const collection = db.collection("users");

  // Step 1: Remove documents where phone is explicitly null.
  const deleteResult = await collection.deleteMany({ phone: null });
  console.log(`Deleted ${deleteResult.deletedCount} user(s) with phone: null.`);

  // Step 2: Unset phone field on any remaining docs where phone is an empty string
  // (null docs were already removed in Step 1; this handles the "" edge case).
  const unsetResult = await collection.updateMany(
    { phone: "" },
    { $unset: { phone: "" } }
  );
  console.log(`Unset phone on ${unsetResult.modifiedCount} user(s) with empty phone.`);

  // Step 3: Drop the existing phone_1 index (may be non-sparse).
  const indexes = await collection.indexes();
  const phoneIndex = indexes.find((idx) => idx.name === "phone_1");

  if (phoneIndex) {
    await collection.dropIndex("phone_1");
    console.log("Dropped old phone_1 index.");
  } else {
    console.log("phone_1 index not found — skipping drop.");
  }

  // Step 4: Recreate the index as unique + sparse.
  await collection.createIndex(
    { phone: 1 },
    { unique: true, sparse: true, name: "phone_1" }
  );
  console.log("Recreated phone_1 index as unique + sparse.");

  await mongoose.disconnect();
  console.log("Done. Migration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
