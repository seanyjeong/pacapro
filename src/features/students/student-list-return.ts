const STUDENT_LIST_RETURN_KEY = 'paca_student_list_return';

// 목록에서 학생 화면으로 들어갈 때 현재 목록 주소를 기억해 두고, 상세의 "목록으로"에서 되돌아간다.
export function rememberStudentListReturn(studentId: number) {
    window.sessionStorage.setItem(
        STUDENT_LIST_RETURN_KEY,
        JSON.stringify({ studentId, url: `${window.location.pathname}${window.location.search}` }),
    );
}

export function getStudentListReturnUrl(studentId: number): string {
    const stored = window.sessionStorage.getItem(STUDENT_LIST_RETURN_KEY);
    if (!stored) return '/students';
    try {
        const saved = JSON.parse(stored) as { studentId?: number; url?: string };
        return saved.studentId === studentId && saved.url?.startsWith('/students') ? saved.url : '/students';
    } catch {
        return '/students';
    }
}
