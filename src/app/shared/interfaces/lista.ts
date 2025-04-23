export interface Lista {
    nombre: string,
    compartida: boolean,
    uidsPermitidos: string[]
    id?: string,
    descripcion?: string,
    elementos?: ElementoLista[],
    categorias?: string[]
}

export interface ElementoLista {
    nombre: string,
    descripcion?: string,
    cantidad?: number,
    unidadMedida?: string,
    variedades?: string[] // Hay que hacer una transformacion de string con este formato 
    checkeado: boolean,
    categoria?: string
}