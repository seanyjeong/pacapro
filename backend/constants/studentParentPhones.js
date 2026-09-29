const STUDENT_PARENT_PHONE_FIELDS = Object.freeze(['father_phone', 'mother_phone']);
const STUDENT_PARENT_PHONE_LABELS = Object.freeze({
    father_phone: '아버지 전화번호', mother_phone: '어머니 전화번호',
});
const STUDENT_PARENT_PHONE_PATTERN = /^\d{3}-\d{3,4}-\d{4}$/;
const STUDENT_PARENT_PHONE_DIGITS_PATTERN = /^(\d{3})(\d{3,4})(\d{4})$/;

module.exports = {
    STUDENT_PARENT_PHONE_FIELDS, STUDENT_PARENT_PHONE_LABELS,
    STUDENT_PARENT_PHONE_PATTERN, STUDENT_PARENT_PHONE_DIGITS_PATTERN,
};
