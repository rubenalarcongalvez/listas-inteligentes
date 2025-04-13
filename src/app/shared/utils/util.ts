export function normalizarCadena(cadena: string) {
    return String(cadena.toLowerCase()).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}