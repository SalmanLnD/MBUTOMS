import * as rules from '../utils/attendanceOifRules.js';
import * as catalog from '../utils/subjectOifCatalog.js';

console.log('isItOif CA26421 ->', rules.isItOif('CA26421'));
console.log('allowsManual CA26421 ->', rules.allowsManualClassHandlingHours('CA26421'));
console.log('isCampusSubjectOif CA26421 ->', catalog.isCampusSubjectOif('CA26421'));
console.log('isItOif IT ->', rules.isItOif('IT'));
console.log('allowsManual IT ->', rules.allowsManualClassHandlingHours('IT'));
