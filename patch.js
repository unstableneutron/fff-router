const fs = require('fs');
let code = fs.readFileSync('lib/fff-router/daemon-autostart.ts', 'utf8');

code = code.replace(
  `      if (mismatchKind(error) === "protocol" || mismatchKind(error) === "server") {
        if (pid) {
          await deps.terminateProcess(pid);
        }
      } else if (!isRecoverableHealthError(error)) {
        throw error;
      }`,
  `      if (mismatchKind(error) === "protocol" || mismatchKind(error) === "server" || mismatchKind(error) === "reload") {
        if (pid) {
          await deps.terminateProcess(pid);
        }
      } else if (!isRecoverableHealthError(error)) {
        throw error;
      }`
);

fs.writeFileSync('lib/fff-router/daemon-autostart.ts', code);
