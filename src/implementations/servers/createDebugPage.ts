import { PARAM_SESSION_ID } from '../../core/constants';
import { TestSessionManager } from '../../core/TestSessionManager';

export function createDebugPage(sessions: TestSessionManager) {
  return `<!DOCTYPE html>
<html>
  <head></head>
  <body>
    Choose a test file to debug:
    <ul>
     ${Array.from(sessions.all())
       .map(
         (s) =>
           `<li>
              <a href="/?${PARAM_SESSION_ID}=${s.id}&wtr-debug=true" target="_blank" rel="noopener noreferrer">
              ${s.testFile}
              </a>
           </li>`
       )
       .join('\n    ')}
    </ul>
  </body>
</html>`;
}
