import { ChangeDetectorRef, Component, computed, ElementRef, signal, ViewChild } from '@angular/core';
import { User } from '@angular/fire/auth';
import { ReactiveFormsModule, FormsModule, FormGroup, Validators, FormBuilder } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService, MessageService, ToastMessageOptions } from 'primeng/api';
import { LoginComponent } from './shared/components/login/login.component';
import { FooterComponent } from './shared/footer/footer.component';
import { AuthService } from './shared/services/auth.service';
import { StorageService } from './shared/services/storage.service';
import { PrimeNgModule } from './shared/style/prime-ng/prime-ng.module';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { ElementoLista, Lista } from './shared/interfaces/lista';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { normalizarCadena } from './shared/utils/util';
import {CdkDragDrop, CdkDropList, CdkDrag, moveItemInArray} from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-root',
  imports: [PrimeNgModule, ReactiveFormsModule, FormsModule, FooterComponent, LoginComponent, SidebarComponent, FormsModule, CdkDropList, CdkDrag],
  providers: [MessageService, ConfirmationService],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  @ViewChild('sidebarRef') sidebarComponent!: SidebarComponent;
  @ViewChild('inputPrincipal') inputPrincipal!: AutoComplete;
  modoFiltradoTotal: boolean = true;

  /* Auth */
  messages: ToastMessageOptions[] = [];
  visibleDeleteUserPopup: boolean = false;
  visibleUpdateEmailPopup: boolean = false;
  visibleUpdatePasswordPopup: boolean = false;
  visiblePopupAddElemento: boolean = false;
  visiblePopupEditElemento: boolean = false;
  visiblePopupImportElementos: boolean = false;
  visiblePopupGestionarCategorias: boolean = false;
  visiblePopupEditarCategoria: boolean = false;
  updateEmailForm: FormGroup;
  updatePasswordForm: FormGroup;
  formAddEditElemento!: FormGroup;
  formImportElementoEstructurado!: FormGroup;

  /* Datos */
  listas = signal<Lista[]>([]);
  nombreFiltrar = signal<string>('');
  nombreCategoriaForm = signal<string>('');
  nombreCategoriaAnterior = signal<string>('');
  idListaSeleccionada = signal<string>('');
  listaSeleccionada = computed(() => {
    let listaSeleccionadaFinal = this.listas().find(lista => lista?.id === this.idListaSeleccionada()) || (this.listas()[0] || null);
    
    listaSeleccionadaFinal?.elementos?.sort((a, b) => {
      const checkComp = Number(a?.checkeado) - Number(b?.checkeado);
      if (checkComp !== 0) {
        return checkComp;
      }
  
      const categoriaA = normalizarCadena(a?.categoria || '');
      const categoriaB = normalizarCadena(b?.categoria || '');
  
      /* Si la categoria esta vacia, se pone lo ultimo */
      if (!categoriaA && categoriaB) return 1;
      if (categoriaA && !categoriaB) return -1;
      return categoriaA.localeCompare(categoriaB);
    });
  
    return listaSeleccionadaFinal;
  });   
  nombreElementoEditando = null;
  listaFiltradaElementos: ElementoLista[] = [];
  listaFiltradaCategorias: string[] = [];
  cargando: boolean = true;

  claseSiElementoPasaFiltro(nombreElemento: string): string {
    const resultado = !this.nombreFiltrar() || normalizarCadena(nombreElemento)?.includes(normalizarCadena(this.nombreFiltrar()));

    if (resultado) return '';
    return this.modoFiltradoTotal ? 'hidden' : 'opacity-25';
  }

  constructor(private confirmationService: ConfirmationService, private messageService: MessageService, private cdr: ChangeDetectorRef, private storageService: StorageService, private authService: AuthService, private fb: FormBuilder) {
    this.updateEmailForm = this.fb.group({
      previousEmail: ['', Validators.required],
      email: ['', Validators.required],
      emailConfirmation: ['', Validators.required],
    });
    this.updatePasswordForm = this.fb.group({
      password: ['', Validators.required],
      passwordConfirmation: ['', Validators.required],
    });
    this.formAddEditElemento = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: [''],
      cantidad: [],
      unidadMedida: [''],
      variedadActual: [[]],
      variedades: [''],
      categoria: [''],
    });
    this.formImportElementoEstructurado = this.fb.group({
      texto: ['', Validators.required],
      quitarPrimeraLinea: [true]
    });
  }

  ngAfterViewInit() {
    if (typeof window !== 'undefined' && window.localStorage) {
      this.listas.set(JSON.parse(localStorage.getItem('listas')!) ?? []);
    }
    this.inicializarDatosBBDD().then(() => {
      // Para que solo se ejecute una vez si necesitamos que se ejecute algo
    });
    this.cdr.detectChanges();
  }

  /*=============================================
  =            Auth            =
  =============================================*/
  
  get loggedIn() : boolean {
    // return this.authService.getCurrentUser() != null; //It is a bit slow to detect it on first instance
    return this.storageService.isLoggedIn(); //In case we use localStorage
  } 
  
  get getUser() : User | null {
    return this.authService.getCurrentUser();
  }

  isEmailAuth(): boolean {
    if (this.getUser && this.getUser?.providerData?.findIndex(p => p.providerId === 'password') != -1) {
      return true;
    }
    return false;
  }

  updateUserEmail() {
    if (this.updateEmailForm.get('previousEmail')?.value == this.getUser?.email && this.updateEmailForm.valid && this.updateEmailForm.get('email')?.value == this.updateEmailForm.get('emailConfirmation')?.value) {
      this.authService.updateEmail(this.getUser!, this.updateEmailForm.get('email')?.value).then(() => {
        this.updateEmailForm.reset();
        this.visibleUpdateEmailPopup = false;
        this.messageService.add({ severity: 'info', summary: 'Confirma tu email', detail: 'Por favor, confirma tu email antes de ingresar', life: 3000 });
      }).catch((err: Error) => {
        if (err.message.includes('requires-recent-login')) {
          this.messageService.add({ severity: 'warn', summary: 'Inicia sesión', detail: 'Debes iniciar sesión de nuevo para realizar esta acción', life: 3000 });
          setTimeout(() => {
            this.logout();
          }, 2000); 
        } else {
          this.messages = [({ severity: 'error', summary: 'Error en el email', detail: 'No puedes cambiar a este email', life: 3000 })];
        }
        console.error(err);
      });
    } else {
      this.messages = [];
      if (this.updateEmailForm.get('previousEmail')?.value != this.getUser?.email) {
        this.messages.push({ severity: 'error', summary: 'Email anterior inválido', detail: 'Por favor, ingresa correctamente el correo anterior', life: 3000 });
      }
      if (this.updateEmailForm.invalid) {
        this.messages.push({ severity: 'warn', summary: 'Nuevo email inválido', detail: 'Por favor, ingresa un correo válido', life: 3000 });
      }
      if (this.updateEmailForm.get('email')?.value != this.updateEmailForm.get('emailConfirmation')?.value) {
        this.messages.push({ severity: 'warn', summary: 'Emails no coinciden', detail: 'Los nuevos correos no coinciden', life: 3000 });
      }
    }
  }

  updateUserPassword() {
    if (this.updatePasswordForm.valid && this.updatePasswordForm.get('password')?.value == this.updatePasswordForm.get('passwordConfirmation')?.value) {
      this.authService.updatePassword(this.getUser!, this.updatePasswordForm.get('password')?.value).then(() => {
        this.updatePasswordForm.reset();
        this.visibleUpdatePasswordPopup = false;
        this.messageService.add({ severity: 'info', summary: 'Contraseña cambiada', detail: 'Contraseña cambiada con éxito', life: 3000 });
      }).catch((err: Error) => {
        if (err.message.includes('requires-recent-login')) {
          this.messageService.add({ severity: 'warn', summary: 'Inicia sesión', detail: 'Debes iniciar sesión de nuevo para realizar esta acción', life: 3000 });
          setTimeout(() => {
            this.logout();
          }, 2000); 
          this.logout();
        } else {
          this.messages = [({ severity: 'error', summary: 'Error de contraseña', detail: 'No puedes poner esta contraseña', life: 3000 })];
        }
        console.error(err);
      });
    } else {
      this.messages = [];
      if (this.updatePasswordForm.invalid) {
        this.messages.push({ severity: 'warn', summary: 'Contraseña inválida', detail: 'La contraseña debe ser al menos de 6 caracteres y máximo 30, y no puede contener <code>|\\/</code>', life: 3000 });
      }
      if (this.updatePasswordForm.get('password')?.value != this.updatePasswordForm.get('passwordConfirmation')?.value) {
        this.messages.push({ severity: 'warn', summary: 'Contraseñas no coinciden', detail: 'Las nuevas contraseñas no coinciden', life: 3000 });
      }
    }
  }

  deleteUser() {
    this.authService.deleteUser(this.getUser!).then(() => {
      this.visibleDeleteUserPopup = false;
      this.messageService.add({ severity: 'info', summary: 'Usuario eliminado', detail: 'Usuario eliminado con éxito', life: 3000 });
      setTimeout(() => {
        this.logout();
      }, 2000);
    }).catch((err: Error) => {
      if (err.message.includes('requires-recent-login')) {
        this.messageService.add({ severity: 'warn', summary: 'Inicia sesión', detail: 'Debes iniciar sesión de nuevo para realizar esta acción', life: 3000 });
        setTimeout(() => {
          this.logout();
        }, 2000); 
        this.logout();
      } 
      console.error(err);
    });
  }

  logout() {
    this.authService.logout();
  }
  
  /*=====  Final de Auth  ======*/

  /*=============================================
  =            Database            =
  =============================================*/

  async inicializarDatosBBDD(): Promise<void> {
    const user = await firstValueFrom(this.authService.getCurrentUserPeticion());
    if (!user) return;
  
    // Escucha en tiempo real las listas
    this.storageService.getFilteredDocumentsByUID(user.uid).subscribe({
      next: (listas) => {
        this.listas.set(listas);
      },
      error: (err) => console.error(err)
    });
  
    // Escucha en tiempo real la lista predeterminada
    this.storageService.getListaPredeterminada(user.uid).subscribe({
      next: (idPredet) => {
        const listasActuales = this.listas();
        const idSeleccionar = listasActuales?.some(lista => lista?.id === idPredet)
          ? idPredet
          : listasActuales[0]?.id || null;
        this.idListaSeleccionada?.set(idSeleccionar);
        this.cargando = false;
      },
      error: (err) => {
        console.error(err); this.cargando = false;
      }
    });
  }  

  guardarLista(lista: Lista, dejarDeCompartir: boolean = false, confirmar: boolean = true): any {
    if (!this.authService.getCurrentUser()?.uid) {
      return;
    }

    if (lista?.uidsPermitidos && !lista?.uidsPermitidos?.includes(this.authService.getCurrentUser()?.uid)) {
      lista.uidsPermitidos.push(this.authService.getCurrentUser()?.uid);
    }

    this.storageService.setLista(lista, lista.id, (dejarDeCompartir ? this.authService.getCurrentUser()?.uid : undefined)).subscribe({
      next: () => {
        // Recargamos listas
        this.storageService.getFilteredDocumentsByUID(this.authService.getCurrentUser()?.uid).subscribe({
          next: (resp: Lista[]) => {
            this.listas.set(resp);
            if (dejarDeCompartir) {
              // Seleccionamos la lista que hemos dejado de compartir
              this.idListaSeleccionada?.set(resp.find(l => l?.nombre == lista?.nombre)?.id);
            }
            if (confirmar) {
              this.messageService.add({ severity: 'info', summary: (dejarDeCompartir ? 'Has dejado de compartir la lista' : 'Lista guardada'), life: 3000 });
            }
          }
        });
      }
    });
  }

  filtrarNombresElementos(event: AutoCompleteCompleteEvent) {
    let filtered: any[] = [];
    let query = event.query;

    for (let i = 0; i < (this.listaSeleccionada()?.elementos as ElementoLista[]).length; i++) {
        let lista = (this.listaSeleccionada()?.elementos as ElementoLista[])[i];
        if (normalizarCadena(lista.nombre).includes(normalizarCadena(query))) {
            filtered.push(lista);
        }
    }

    this.listaFiltradaElementos = filtered;
  }

  filtrarNombresCategorias(event: AutoCompleteCompleteEvent) {
    let filtered: any[] = [];
    let query = event.query;

    this.listaSeleccionada()?.categorias?.forEach(categoria => {
      if (normalizarCadena(categoria).includes(normalizarCadena(query))) {
        filtered.push(categoria);
      }
    });

    this.listaFiltradaCategorias = filtered;
  }

  addElemento() {
    if (!this.authService.getCurrentUser()?.uid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `Usuario no encontrado`,
        life: 3000
      });
      return;
    }

    if (this.formAddEditElemento.valid) {
      if (!this.listaSeleccionada().elementos) {
        this.listaSeleccionada().elementos = [];
      }

      const categoriaElemento = this.formAddEditElemento?.get('categoria')?.value && (normalizarCadena(this.formAddEditElemento?.get('categoria')?.value) != normalizarCadena('Sin categoria')) ? this.formAddEditElemento?.get('categoria')?.value : null;
      
      let elementoAModificar = this.listaSeleccionada().elementos?.find(elemento => elemento.nombre.toLowerCase() == this.formAddEditElemento.get('nombre')?.value.toLowerCase());
      
      if (elementoAModificar) {
        this.preguntarModificarElemento(elementoAModificar);
      } else {
        // Si no existia antes, ponemos el elemento nuevo
        elementoAModificar = {
          nombre: this.formAddEditElemento.get('nombre')?.value,
          descripcion: this.formAddEditElemento.get('descripcion')?.value || '',
          checkeado: this.formAddEditElemento.get('checkeado')?.value || false,
          cantidad: this.formAddEditElemento.get('cantidad')?.value,
          unidadMedida: this.formAddEditElemento.get('unidadMedida')?.value,
          variedades: this.formAddEditElemento.get('variedades')?.value || [],
          categoria: categoriaElemento,
        }
        this.listaSeleccionada().elementos.push(elementoAModificar);
        /* Si no existia la categoria antes, la creamos */
        if (categoriaElemento && !this.listaSeleccionada()?.categorias?.map(cat => normalizarCadena(cat)).includes(normalizarCadena(categoriaElemento))) {
          if (this.listaSeleccionada()?.categorias?.length) {
            this.listaSeleccionada().categorias.push(categoriaElemento);
          } else {
            this.listaSeleccionada().categorias = [categoriaElemento];
          }
        }

        this.guardarCambiosElemento();
      }
    } else {
      this.messageService.add({ severity: 'error', summary: 'El nombre es obligatorio', life: 3000 });
    }
  }

  private preguntarModificarElemento(elementoAModificar: ElementoLista, mensaje?: string, elementoAEliminar?: ElementoLista) {
    if (!elementoAModificar.checkeado) {
      // Si el elemento no estaba tachado preguntamos si quiere añadir o cancelamos
      this.confirmationService.confirm({
        message: 'El elemento ya existe, se añadirá la cantidad y variedades seleccionadas al elemento existente',
        icon: 'pi-cart-plus',
        rejectButtonStyleClass: 'bg-white text-black p-button-sm',
        acceptButtonStyleClass: 'bg-green-400 text-black p-button-sm',
        rejectLabel: 'Cancelar',
        acceptLabel: 'Confirmar',
        accept: () => {
          /* Si no existia la categoria antes, la creamos */
          const categoriaElemento = this.formAddEditElemento?.get('categoria')?.value && (normalizarCadena(this.formAddEditElemento?.get('categoria')?.value) != normalizarCadena('Sin categoria')) ? this.formAddEditElemento?.get('categoria')?.value : null;
          if (categoriaElemento && !this.listaSeleccionada()?.categorias?.map(cat => normalizarCadena(cat)).includes(normalizarCadena(categoriaElemento))) {
            if (this.listaSeleccionada()?.categorias?.length) {
              this.listaSeleccionada().categorias.push(categoriaElemento);
            } else {
              this.listaSeleccionada().categorias = [categoriaElemento];
            }
          }

          // Si tenia descripcion, se deja, excepto si tiene una nueva
          elementoAModificar.descripcion = (elementoAModificar.descripcion && !this.formAddEditElemento.get('descripcion')?.value) ? elementoAModificar.descripcion : this.formAddEditElemento.get('descripcion')?.value;

          // Si el elemento tenia otras variantes aparte, se anaden
          if (elementoAModificar?.variedades?.length) {
            let variedadesAnadir = this.formAddEditElemento?.get('variedades')?.value || [];
            if (variedadesAnadir?.length) {
              variedadesAnadir = this.formAddEditElemento?.get('variedades')?.value?.filter(variedad => !elementoAModificar?.variedades?.includes(variedad?.toLowerCase()));
              elementoAModificar.variedades.push(...variedadesAnadir);
            }
          } else {
            elementoAModificar.variedades = this.formAddEditElemento.get('variedades')?.value || [];
          }

          // Establecemos cantidades
          const cantidadAnterior = elementoAModificar?.cantidad || 1;
          const cantidadAAnadir = this.formAddEditElemento.get('cantidad')?.value || 1;
          elementoAModificar.cantidad = cantidadAnterior + cantidadAAnadir;

          // Si seteamos de nuevo la unidad de medida, la cambiamos
          if (this.formAddEditElemento.get('unidadMedida')?.value) {
            elementoAModificar.unidadMedida = this.formAddEditElemento.get('unidadMedida')?.value;
          }

          // Si hay que eliminar el anterior, se elimina
          if (elementoAEliminar) {
            this.listaSeleccionada().elementos?.splice(this.listaSeleccionada().elementos.indexOf(elementoAEliminar), 1);
          }
          this.guardarCambiosElemento(true, mensaje);
        }
      });
    } else {
      this.confirmationService.confirm({
        message: 'El elemento ya existe y estaba tachado. Se sobreescribirá y des-tachará',
        icon: 'pi-check-square',
        rejectButtonStyleClass: 'bg-white text-black p-button-sm',
        acceptButtonStyleClass: 'bg-green-400 text-black p-button-sm',
        rejectLabel: 'Cancelar',
        acceptLabel: 'Confirmar',
        accept: () => {
          /* Si no existia la categoria antes, la creamos */
          const categoriaElemento = this.formAddEditElemento?.get('categoria')?.value && (normalizarCadena(this.formAddEditElemento?.get('categoria')?.value) != normalizarCadena('Sin categoria')) ? this.formAddEditElemento?.get('categoria')?.value : null;
          if (categoriaElemento && !this.listaSeleccionada()?.categorias?.map(cat => normalizarCadena(cat)).includes(normalizarCadena(categoriaElemento))) {
            if (this.listaSeleccionada()?.categorias?.length) {
              this.listaSeleccionada().categorias.push(categoriaElemento);
            } else {
              this.listaSeleccionada().categorias = [categoriaElemento];
            }
          }

          // Lo sustituimos por lo nuevo (si lo nuevo no tiene nada y lo antiguo si, se queda lo antiguo)
          elementoAModificar.nombre = this.formAddEditElemento.get('nombre')?.value;
          elementoAModificar.descripcion = (elementoAModificar.descripcion && !this.formAddEditElemento.get('descripcion')?.value) ? elementoAModificar.descripcion : this.formAddEditElemento.get('descripcion')?.value;
          elementoAModificar.checkeado = this.formAddEditElemento.get('checkeado')?.value || false;
          elementoAModificar.cantidad = this.formAddEditElemento.get('cantidad')?.value;
          elementoAModificar.unidadMedida = this.formAddEditElemento.get('unidadMedida')?.value;

          // Si el elemento tenia otras variantes aparte, se anaden
          if (elementoAModificar?.variedades?.length) {
            let variedadesAnadir = this.formAddEditElemento?.get('variedades')?.value || [];
            if (variedadesAnadir?.length) {
              variedadesAnadir = this.formAddEditElemento?.get('variedades')?.value?.filter(variedad => !elementoAModificar?.variedades?.includes(variedad?.toLowerCase()));
              elementoAModificar.variedades.push(...variedadesAnadir);
            }
          } else {
            elementoAModificar.variedades = this.formAddEditElemento.get('variedades')?.value || [];
          }

          // Si hay que eliminar el anterior, se elimina
          if (elementoAEliminar) {
            this.listaSeleccionada().elementos?.splice(this.listaSeleccionada().elementos.indexOf(elementoAEliminar), 1);
          }
          this.guardarCambiosElemento();
        }
      });
    }
  }

  openEditarElemento(elemento: ElementoLista) {
    this.formAddEditElemento = this.fb.group({
      nombre: [elemento.nombre, Validators.required],
      descripcion: [elemento?.descripcion],
      checkeado: [elemento?.checkeado],
      cantidad: [elemento?.cantidad],
      unidadMedida: [elemento?.unidadMedida],
      variedadActual: [''],
      variedades: [elemento?.variedades],
      categoria: [elemento?.categoria || null],
    });
    this.nombreElementoEditando = elemento.nombre;
    this.visiblePopupEditElemento = true;
  }

  editElemento() {
    if (!this.nombreElementoEditando) {
      return;
    }

    if (!this.authService.getCurrentUser()?.uid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `Usuario no encontrado`,
        life: 3000
      });
      return;
    }

    if (this.formAddEditElemento.valid) {
      const categoriaElemento = this.formAddEditElemento?.get('categoria')?.value && (normalizarCadena(this.formAddEditElemento?.get('categoria')?.value) != normalizarCadena('Sin categoria')) ? this.formAddEditElemento?.get('categoria')?.value : null;

      // Buscamos el elemento
      let elementoBuscado = this.listaSeleccionada().elementos?.find(elemento => elemento.nombre.toLowerCase() == this.formAddEditElemento.get('nombre')?.value.toLowerCase());
      let elementoAModificar = this.listaSeleccionada().elementos.find(elemento => elemento.nombre == this.nombreElementoEditando);
  
      if (elementoBuscado && elementoBuscado.nombre != elementoAModificar.nombre) {
        // Si ya existe
        this.preguntarModificarElemento(elementoBuscado, 'Elemento reemplazado', elementoAModificar);
      } else {
        // Si no existia o es el mismo que el nuestro
        // Lo sustituimos por lo nuevo
        elementoAModificar.nombre = this.formAddEditElemento.get('nombre')?.value;
        elementoAModificar.descripcion = this.formAddEditElemento.get('descripcion')?.value || '';
        elementoAModificar.checkeado = this.formAddEditElemento.get('checkeado')?.value || false;
        elementoAModificar.cantidad = this.formAddEditElemento.get('cantidad')?.value;
        elementoAModificar.unidadMedida = this.formAddEditElemento.get('unidadMedida')?.value;
        elementoAModificar.variedades = this.formAddEditElemento.get('variedades')?.value || [];
        elementoAModificar.categoria = categoriaElemento;

        /* Si no existia la categoria antes, la creamos */
        if (categoriaElemento && !this.listaSeleccionada()?.categorias?.map(cat => normalizarCadena(cat)).includes(normalizarCadena(categoriaElemento))) {
          if (this.listaSeleccionada()?.categorias?.length) {
            this.listaSeleccionada().categorias.push(categoriaElemento);
          } else {
            this.listaSeleccionada().categorias = [categoriaElemento];
          }
        }
  
        this.guardarCambiosElemento(true, 'Elemento editado');
      }
    } else {
      this.messageService.add({ severity: 'error', summary: 'El nombre es obligatorio', life: 3000 });
    }
  }

  private guardarCambiosElemento(confirmacion: boolean = true, mensaje?: string) {
    // Guardamos los cambios
    this.storageService.setLista(this.listaSeleccionada(), this.idListaSeleccionada()).subscribe({
      next: () => {
        if (confirmacion) {
          this.messageService.add({
            severity: 'info',
            summary: mensaje || 'Elemento añadido',
            life: 3000
          });
        }
      }, error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          life: 3000
        });
      }
    }).add(() => {
      this.visiblePopupAddElemento = false;
      this.visiblePopupEditElemento = false;
    });
  }

  anadirVariedad() {
    if (!this.formAddEditElemento.get('variedades')?.value?.length) {
      this.formAddEditElemento.get('variedades').setValue([]);
    }

    if (this.formAddEditElemento.get('variedadActual')?.value) {
      const variedades: string[] = this.formAddEditElemento.get('variedades')?.value || [];
      const variedadActual: string = this.formAddEditElemento.get('variedadActual')?.value?.toLowerCase() || '';
      const existe = variedades.some(v => v?.toLowerCase() === variedadActual);
      if (existe) {
        this.messageService.add({ severity: 'error', summary: 'Variedad repetida...', detail: 'Pon algo distinto', life: 3000 });
      } else {
        this.formAddEditElemento.get('variedades')?.value.push(this.formAddEditElemento.get('variedadActual')?.value);
        this.formAddEditElemento.get('variedadActual').reset();
      }
    } else {
      this.messageService.add({ severity: 'error', summary: 'Hay que poner algo...', detail: 'Pon algo para añadir', life: 3000 });
    }
  }

  borrarVariedad(variedad: string) {
    this.formAddEditElemento?.get('variedades')?.value.splice(this.formAddEditElemento?.get('variedades')?.value.indexOf(variedad), 1);
  }

  toggleCheck(elemento: ElementoLista) {
    elemento.checkeado = !elemento.checkeado;
    this.guardarCambiosElemento(false);
  }

  borrarElemento(elemento: ElementoLista) {
    this.confirmationService.confirm({
      message: '¿Seguro que quieres borrar el elemento?',
      icon: 'pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'bg-white text-black p-button-sm',
      rejectLabel: 'Cancelar',
      acceptLabel: 'Borrar elemento',
      accept: () => {
        this.listaSeleccionada().elementos.splice(this.listaSeleccionada().elementos?.indexOf(elemento), 1);
        this.guardarCambiosElemento(true, "Elemento borrado");
      }
    });
  }

  predeterminarLista(idLista: string) {
    if (!this.authService.getCurrentUser()?.uid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `Usuario no encontrado`,
        life: 3000
      });
      return;
    }

    this.storageService.setListaPredeterminada(this.authService.getCurrentUser().uid, idLista).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Lista predeterminada',
          detail: `Al abrir la aplicación, se cargará esta lista`,
          life: 3000
        });
      }, error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error al predeterminar lista',
          life: 3000
        });
      }
    });
  }

  eliminarLista(data: { lista: Lista, event: Event }) {
    if (!this.authService.getCurrentUser()?.uid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `Usuario no encontrado`,
        life: 3000
      });
      return;
    }

    this.confirmationService.confirm({
      target: data.event.target,
      header: 'Confirmación',
      message: `¿Seguro que quieres eliminar la lista?`,
      rejectButtonStyleClass: 'bg-white text-black p-button-sm',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectLabel: 'Cancelar',
      acceptLabel: 'Eliminar',
      accept: () => {
        if (data?.lista?.uidsPermitidos?.length <= 1) {
          this.storageService.eliminarLista(data.lista?.id).subscribe({
            next: () => {
              this.listas.set(this.listas().filter(lista => lista?.id !== data?.lista?.id));
              this.messageService.add({
                severity: 'info',
                summary: 'Lista eliminada',
                life: 3000
              });
            }, error: () => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error al eliminar lista',
                life: 3000
              });
            }
          });
        } else {
          // Si hay mas usuarios en esa lista, la eliminamos solo para nosotros
          this.storageService.setLista(data?.lista, data?.lista?.id, this.authService.getCurrentUser()?.uid).subscribe({
            next: () => {
              this.listas.set(this.listas().filter(lista => lista?.id !== data?.lista?.id));
              this.messageService.add({
                severity: 'info',
                summary: 'Lista eliminada',
                life: 3000
              });
            }, error: () => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error al eliminar lista',
                life: 3000
              });
            }
          });
        }
      }
    });
  }

  anadirCompartida(idLista: string) {
    this.storageService.getListaCompartidaPorId(idLista).subscribe({
      next: (resp: Lista) => {
        // Ahora, nos anadimos como usuario para tener permiso
        if (!this.authService.getCurrentUser()?.uid) {
          return;
        }

        if (this.listas().find(l => l.nombre.toLowerCase() == resp.nombre.toLowerCase())) {
          this.messageService.add({
            severity: 'error',
            summary: 'Ya existe una lista con ese nombre',
            life: 3000
          });
          return;
        }

        let lista = resp;
    
        if (!lista?.uidsPermitidos?.includes(this.authService.getCurrentUser()?.uid)) {
          lista.uidsPermitidos.push(this.authService.getCurrentUser()?.uid);
        }

        // La guardamos para nuestro usuario tambien
        this.storageService.setLista(lista, idLista).subscribe({
          next: () => {
            // Le volvemos a poner su id y anadimos a nuestra lista
            lista.id = idLista;
            this.listas().push(lista);
            this.inicializarDatosBBDD();

            this.messageService.add({
              severity: 'info',
              summary: 'Te has unido a la lista compartida',
              detail: lista.nombre,
              life: 3000
            });
          }, error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Hubo un error al unirte a la lista',
              life: 3000
            });
          }
        });
      }, error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'La lista no está compartida o no existe',
          life: 3000
        });
      }
    });
  }
  
  /*=====  Final de Database  ======*/

  importElementos() {
    if (this.formImportElementoEstructurado.valid) {
      let textoFinal = this.formImportElementoEstructurado.get('texto')?.value || ''; // Lo capturamos
      if (this.formImportElementoEstructurado.get('quitarPrimeraLinea')?.value) {
        textoFinal = textoFinal.split('\n').slice(1).join('\n'); // Le quitamos la primera linea
      }
      let listaProcesada: string[] = textoFinal
      .split('\n')
      .filter(linea =>
        linea.trim() !== '' && !(linea.startsWith('[') && linea.endsWith(']'))
      );
      
      this.confirmationService.confirm({
        header: '¿Seguro que quieres añadir y combinar todos los elementos?',
        message: listaProcesada.join('\n'),
        rejectButtonStyleClass: 'bg-white text-black p-button-sm',
        rejectLabel: 'Cancelar',
        acceptLabel: 'Añadir todo',
        accept: () => {
          // Procesamos todo lo que habia antes y anadimos a nuestra lista
          
          // Primero ponemos lo que estaba en la lista
          let listaProcesadaRepetida = listaProcesada.filter(elemento => this.listaSeleccionada().elementos.some(ele => ele.nombre.toLowerCase() == elemento.toLowerCase())); // Elementos repetidos en la lista
          listaProcesadaRepetida = listaProcesadaRepetida.map(e => e.toLowerCase()); // Lo ponemos lowercase
          listaProcesadaRepetida = listaProcesadaRepetida.filter(elemento => listaProcesadaRepetida.includes(elemento.toLowerCase())) // Le quitamos los duplicados

          listaProcesada = listaProcesada.filter(elemento => !this.listaSeleccionada().elementos.some(ele => ele.nombre.toLowerCase() == elemento.toLowerCase())); // Lista nueva

          // Luego anadimos o modificamos
          // Anadimos
          this.listaSeleccionada().elementos.push(
            ...listaProcesada.map(e => ({ nombre: e, checkeado: false } as ElementoLista))
          );
          // Modificamos elementos
          this.listaSeleccionada().elementos.map(elem => {
              if (listaProcesadaRepetida.includes(elem.nombre.toLowerCase())) {
                elem.checkeado = false;
              }
              return elem;
            }
          );

          this.storageService.setLista(this.listaSeleccionada(), this.idListaSeleccionada()).subscribe({
            next: () => {
              this.messageService.add({
                severity: 'info',
                summary: 'Elementos importados',
                life: 3000
              });
            }, error: () => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error al importar',
                life: 3000
              });
            }
          }).add(() => {
            this.visiblePopupImportElementos = false;
          });
        }
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Debes introducir texto',
        life: 3000
      });
    }
  }

  /* No quiero que se pueda tachar/des-tachar con drag and drop, pero si cambiar de categoria con esto */
  drop(event: CdkDragDrop<string[]>) {
    /* Si la categoria del elemento no es la misma que donde la dejamos, la cambiamos */
    if (this.listaSeleccionada()?.elementos[event.previousIndex]?.categoria !== this.listaSeleccionada()?.elementos[event.currentIndex]?.categoria) {
      /* No le podemos pasar undefined ni '', hay que controlarlo para que pase null */
      this.listaSeleccionada().elementos[event.previousIndex].categoria = this.listaSeleccionada().elementos[event.currentIndex]?.categoria || null;
    }
    
    /* Si el elemento lo pasamos a checkeado o des-checkeado o viceversa, lo cambiamos */
    /* Como no quiero esto, lo dejo comentado por si en un futuro lo quiero */
    // if (this.listaSeleccionada()?.elementos[event.previousIndex]?.checkeado !== this.listaSeleccionada()?.elementos[event.currentIndex]?.checkeado) {
    //   this.listaSeleccionada().elementos[event.previousIndex].checkeado = this.listaSeleccionada()?.elementos[event.currentIndex]?.checkeado;
    // }

    moveItemInArray(this.listaSeleccionada().elementos, event.previousIndex, event.currentIndex);
    this.guardarLista(this.listaSeleccionada(), false, false);
  }

  mostrarMensaje(mensaje: string) {
    this.confirmationService.confirm({
      message: mensaje,
      acceptButtonStyleClass: 'bg-white text-black p-button-sm',
      rejectVisible: false,
      acceptLabel: 'Entendido',
    });
  }

  ponerFocusInputPrincipal(tipoInput?: string) {
    setTimeout(() => {
      if (tipoInput == 'autocomplete') {
        this.inputPrincipal?.inputEL?.nativeElement?.focus();
      } else {
        (document.querySelector('.inputPrincipal') as HTMLTextAreaElement)?.focus();
      }
    }, 0);
  }

  elementosCheckeadosLista(checkeado: boolean) {
    return this.listaSeleccionada().elementos.filter(ele => checkeado ? ele?.checkeado : !ele?.checkeado).length || 0;
  }

  primerElementoDeCategoria(elemento: ElementoLista): boolean {
    /* Separamos tambien si esta tachado o no */
    const indexElemento = this.listaSeleccionada().elementos.findIndex(e => e?.nombre == elemento?.nombre && e?.checkeado == elemento?.checkeado);
    const indexPrimerElementoConCategoria = this.listaSeleccionada().elementos.findIndex(e => e?.categoria == elemento?.categoria && e?.checkeado == elemento?.checkeado);
    return indexElemento === indexPrimerElementoConCategoria;
  }

  confirmarEliminarCategoria(categoria: string) {
    this.confirmationService.confirm({
      header: '¿Seguro que quieres eliminar esta categoría?',
      message: 'Los elementos que tengan esta categoría se quedarán sin categoría',
      icon: 'pi-exclamation-triangle',
      rejectButtonStyleClass: 'bg-white text-black p-button-sm',
      acceptButtonStyleClass: 'bg-red-400 text-black p-button-sm border-red-400',
      rejectLabel: 'Cancelar',
      acceptLabel: 'Eliminar',
      accept: () => {
        /* Quitamos la categoria de la lista */
        this.listaSeleccionada().categorias = this.listaSeleccionada()?.categorias?.filter(cat => cat !== categoria);

        /* Tambien de los elementos que la tenian */
        this.listaSeleccionada().elementos = this.listaSeleccionada()?.elementos?.map(ele => {
          if (ele.categoria == categoria) {
            ele.categoria = null;
          }
          return ele;
        });

        this.guardarLista(this.listaSeleccionada(), false, false);
        this.messageService.add({ severity: 'info', summary: 'Categoría eliminada', life: 3000 });
      }
    });
  }

  anadirCategoria(categoria: string) {
    if (!categoria) {
      this.messageService.add({ severity: 'error', summary: 'La categoría no se puede crear vacía', life: 3000 });
    } else if (this.listaSeleccionada()?.categorias && this.listaSeleccionada()?.categorias.map(cat => normalizarCadena(cat)).includes(categoria)) {
      this.messageService.add({ severity: 'error', summary: 'La categoría ya está en la lista', life: 3000 });
      return;
    } else {
      if (!this.listaSeleccionada()?.categorias?.length) {
        this.listaSeleccionada().categorias = [];
      }
      this.listaSeleccionada().categorias.push(categoria);
      this.nombreCategoriaForm.set('');
    }

    this.guardarLista(this.listaSeleccionada(), false, false);
    this.messageService.add({ severity: 'info', summary: 'Categoría añadida', life: 3000 });
  }

  editarCategoria(categoria: string, categoriaAnterior: string) {
    if (!categoria) {
      this.messageService.add({ severity: 'error', summary: 'La categoría no se puede poner vacía', life: 3000 });
    } else if (this.listaSeleccionada()?.categorias && this.listaSeleccionada()?.categorias.map(cat => normalizarCadena(cat)).includes(categoria)) {
      this.messageService.add({ severity: 'error', summary: 'La categoría ya está en la lista', life: 3000 });
      return;
    } else {
      /* Debemos cambiar tanto de la lista como de todos los elementos que tuvieran la categoria */

      /* De la lista */
      if (!this.listaSeleccionada()?.categorias?.length) {
        this.listaSeleccionada().categorias = [];
      }
      let indiceCategoriaAnterior = this.listaSeleccionada()?.categorias?.indexOf(categoriaAnterior);
      if (indiceCategoriaAnterior >= 0) {
        this.listaSeleccionada().categorias[indiceCategoriaAnterior] = categoria;
      }

      /* De los elementos */
      this.listaSeleccionada().elementos = this.listaSeleccionada()?.elementos?.map(ele => {
        if ((ele.categoria ? normalizarCadena(ele.categoria) : ele.categoria) == (categoriaAnterior ? normalizarCadena(categoriaAnterior) :categoriaAnterior)) {
          ele.categoria = categoria;
        }
        return ele;
      });

      this.visiblePopupEditarCategoria = false;
    }

    this.guardarLista(this.listaSeleccionada(), false, false);
    this.messageService.add({ severity: 'info', summary: 'Categoría editada', life: 3000 });
  }
}
