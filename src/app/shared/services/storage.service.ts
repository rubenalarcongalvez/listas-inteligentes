import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { addDoc, collection, deleteDoc, doc, DocumentData, getDoc, getDocs, query, QuerySnapshot, setDoc, where } from 'firebase/firestore';
import { LoggedUser } from '../interfaces/loggedUser';
import { from, map, Observable } from 'rxjs';
import { Lista } from '../interfaces/lista';
import { normalizarCadena } from '../utils/util';

const USER_KEY = 'auth-user';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  constructor(private firestore: Firestore) {}

  clean(): void {
    window.localStorage.clear();
  }

  public saveUser(user: LoggedUser): void {
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  public getUser(): LoggedUser | null {
    const user = window.localStorage.getItem(USER_KEY);
    if (user) {
      return JSON.parse(user) as LoggedUser;
    }

    return null;
  }

  public isLoggedIn(): boolean {
    const user = window.localStorage.getItem(USER_KEY);
    if (user) {
      return true;
    }

    return false;
  }

  /*=============================================
  =            Database management            =
  =============================================*/

  getFilteredDocumentsByUID(uid: any): Observable<DocumentData[]> {
    const colRef = collection(this.firestore, 'listas-inteligentes/listas-doc/listas');
    const q = query(colRef, where('uidsPermitidos', 'array-contains', uid));
  
    const promise = getDocs(q).then(snapshot => {
      const documentos = snapshot.docs.map(doc => {
        const data = doc.data();
        const { uid, ...resto } = data;
  
        return {
          id: doc.id,
          ...resto
        } as Lista;
      });
  
      // Ordenamos por nombre normalizado
      return documentos.sort((a, b) =>
        normalizarCadena(a.nombre).localeCompare(normalizarCadena(b.nombre))
      );
    });
  
    return from(promise);
  }

  getListaCompartidaPorId(idLista: string): Observable<Lista> {
    const docRef = doc(this.firestore, `listas-inteligentes/listas-doc/listas/${idLista}`);
  
    return from(getDoc(docRef)).pipe(
      map((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error('La lista no existe.');
        }
  
        const data = docSnap.data();
        if (!data['compartida']) {
          throw new Error('No tienes acceso a esta lista.');
        }
  
        return {
          id: docSnap.id,
          ...data
        } as Lista;
      })
    );
  }

  // El uid solo se pone si queremos dejar de compartir
  setLista(listaEnviada: Lista, docId?: string, uidDejarCompartir?: string): Observable<void> {    
    let lista = structuredClone(listaEnviada); // Creamos copia para no interferir
    delete lista.id; // Eliminamos su id para que no se guarde en propiedad

    // Si tiene elementos, y tiene variedades, transformamos a string para que se guarde en Firebase
    if (docId) {
      // Si esta dejando de compartir, le quitamos de la lista a ese usuario y clonamos la lista (volvemos a setearLista pero sin el id)
      // Si somos los unicos que tenemos acceso, no hace falta hacer copia, solo sustituir
      if (uidDejarCompartir && lista?.uidsPermitidos?.length > 1) {
        let nuevaListaSinCompartir = structuredClone(lista);
        nuevaListaSinCompartir.uidsPermitidos = [uidDejarCompartir];
        nuevaListaSinCompartir.compartida = false;
        
        lista.compartida = true;
        lista.uidsPermitidos.splice(lista.uidsPermitidos.indexOf(uidDejarCompartir), 1); // Nos quitamos permisos de la lista que dejamos de compartir
        this.setLista(nuevaListaSinCompartir); // Lo guardamos sin el docId para crearnos una copia nosotros y dejar la otra normal pero sin nuestro uid
      } else if (uidDejarCompartir && lista?.uidsPermitidos?.length <= 1) {
        lista.uidsPermitidos = [uidDejarCompartir]; // Solo dejamos nuestros permisos
        lista.compartida = false; // Dejamos de compartir
      }

      const docRef = doc(this.firestore, `listas-inteligentes/listas-doc/listas/${docId}`);
      return from(setDoc(docRef, lista, { merge: true }));
    } else {
      const colRef = collection(this.firestore, 'listas-inteligentes/listas-doc/listas');
      return from(addDoc(colRef, lista).then(() => {}));
    }
  }

  getListaPredeterminada(uid: string): Observable<string | null> {
    const docRef = doc(this.firestore, `listas-inteligentes/usuarios-settings/uids/${uid}`);
  
    const promise = getDoc(docRef).then(snapshot => {
      const data = snapshot.data();
      return data?.['idListaPredeterminada'] ?? null;
    });
  
    return from(promise);
  }
  
  setListaPredeterminada(uid: string, idListaPredeterminada: string): Observable<void> { 
    const docRef = doc(this.firestore, `listas-inteligentes/usuarios-settings/uids/${uid}`);
    return from(setDoc(docRef, { idListaPredeterminada: idListaPredeterminada }, { merge: true }));
  }
  
  eliminarLista(idLista: string): Observable<void> {
    const docRef = doc(this.firestore, `listas-inteligentes/listas-doc/listas/${idLista}`);
    return from(deleteDoc(docRef));
  }
  
  /*=====  Final de Database management  ======*/
}
