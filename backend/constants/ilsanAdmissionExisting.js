const FIELDS = Object.freeze({
  phone: '학생 전화번호', school: '학교', grade: '학년', gender: '성별',
  father_name: '아버님 성함', father_phone: '아버님 전화번호',
  mother_name: '어머님 성함', mother_phone: '어머님 전화번호', parent_phone: '학원 안내 전화번호',
});
const ENCRYPTED_FIELDS = ['phone','father_name','father_phone','mother_name','mother_phone','parent_phone'];
module.exports = { FIELDS, ENCRYPTED_FIELDS };
