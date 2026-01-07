try {
  const status = rs.status();
  print("Replica set already initialized.");
  printjson(status);
} catch (e) {
  print("Initializing replica set...");
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongo:27017" }],
  });

  let isPrimary = false;
  for (let i = 0; i < 60; i++) {
    try {
      const s = rs.status();
      const primary = s.members.find(m => m.stateStr === "PRIMARY");
      if (primary) {
        isPrimary = true;
        print("Replica set PRIMARY elected: " + primary.name);
        break;
      }
    } catch (err) {}
    sleep(1000);
  }

  if (!isPrimary) {
    throw new Error("Replica set initialization timed out");
  }
}
