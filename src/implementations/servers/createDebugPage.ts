import { TestSession } from '../../core/TestSession';
import { PARAM_SESSION_ID } from '../../core/constants';

export function createDebugPage(sessions: TestSession[]) {
  return `<!DOCTYPE html>
<html>
  <head></head>
  <body>
    Choose a test file to debug:
    <ul>
     ${sessions
       .map(
         (s) =>
           `<li><a href="/?${PARAM_SESSION_ID}=${s.id}&wtr-debug=true" target="_blank" rel="noopener noreferrer">${s.testFile}</a></li>`
       )
       .join('\n    ')}
    </ul>
  </body>
</html>`;
}
