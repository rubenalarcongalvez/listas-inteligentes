import { Component, computed, effect, EventEmitter, Input, Output, signal } from '@angular/core';
import { PrimeNgModule } from '../../style/prime-ng/prime-ng.module';
import { MessageService, ToastMessageOptions, ConfirmationService } from 'primeng/api';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ElementoLista, Lista } from '../../interfaces/lista';
import { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { normalizarCadena } from '../../utils/util';

@Component({
  selector: 'app-sidebar',
  imports: [PrimeNgModule, ReactiveFormsModule, FormsModule],
  providers: [MessageService],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  standalone: true
})
export class SidebarComponent {
  @Input() listas = signal<Lista[]>([]);
  listasFiltradasElementos: Lista[] = [];
  @Input() idListaSeleccionada = signal<string>('');
  @Output() setLista = new EventEmitter<Lista>();
  @Output() predeterminarLista = new EventEmitter<string>();
  @Output() eliminarLista = new EventEmitter<{ lista: Lista, event: Event }>();
  @Output() dejarDeCompartir = new EventEmitter<Lista>();
  @Output() anadirCompartida = new EventEmitter<string>();
  
  sidebarVisible: boolean = false;
  visiblePopupAddList: boolean = false;
  visiblePopupAnadirCompartida: boolean = false;
  visiblePopupEditarList: boolean = false;
  visiblePopupCompartirList: boolean = false;
  messages: ToastMessageOptions[] = [];
  formAddLista!: FormGroup;
  formEditLista!: FormGroup;
  formAddListaCompartida!: FormGroup;
  nombreFiltrar = signal<string>('');
  
  public get listasFiltradasListado() : Lista[] {
    return this.listas().filter(lista => !this.nombreFiltrar() || normalizarCadena(lista.nombre).includes(this.nombreFiltrar())).sort((a, b) => normalizarCadena(a.nombre).localeCompare(normalizarCadena(b.nombre)));
  }

  constructor(private fb: FormBuilder, private messageService: MessageService, private confirmationService: ConfirmationService){
    this.formAddLista = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: [''],
      compartida: [false],
      listasOtrosElementos: [[]],
    });
    this.formEditLista = this.fb.group({
      id: [, Validators.required],
      nombre: ['', Validators.required],
      descripcion: [''],
      compartida: [false, Validators.required],
      uidsPermitidos: [[], Validators.required],
    });
    this.formAddListaCompartida = this.fb.group({
      id: [, Validators.required],
    });
  }

  addLista() {
    this.messages = [];
    if (this.formAddLista.invalid) {
      this.messages.push(({ severity: 'error', detail: 'El nombre es obligatorio' }));
    } else if (this.listas().some(lista => lista?.nombre == this.formAddLista?.get('nombre')?.value)) {
      // Controlamos que no se puedan crear mas listas con el mismo nombre
      this.messages.push(({ severity: 'error', detail: 'No puedes crear otra lista con el mismo nombre' }));
    } else {
      const listasOtrosElementos: Lista[] = this.formAddLista.get('listasOtrosElementos')?.value || [];
      let elementos: ElementoLista[] = [];
      listasOtrosElementos?.forEach(lista => {
        // Anadimos todos los elementos que no se repitan
        elementos.push(...lista?.elementos?.filter(elemento => !elementos.some(ele => ele.nombre == elemento.nombre)) || []);
      });

      // Anadimos la lista
      this.setLista.emit({uidsPermitidos: [], nombre: this.formAddLista?.get('nombre')?.value, compartida: this.formAddLista?.get('compartida')?.value || false, descripcion: this.formAddLista?.get('descripcion')?.value || '', elementos: elementos} as Lista);
      this.formAddLista.reset();
      this.visiblePopupAddList = false;
    }
  }

  abrirEditarLista(lista: Lista) {
    this.formEditLista.get('id').setValue(lista.id);
    this.formEditLista.get('nombre').setValue(lista.nombre);
    this.formEditLista.get('descripcion').setValue(lista?.descripcion);
    this.formEditLista.get('compartida').setValue(lista?.compartida);
    this.formEditLista.get('uidsPermitidos').setValue(lista?.uidsPermitidos);
  }

  editLista(dejarDeCompartir: boolean = false) {
    this.messages = [];
    if (this.formEditLista.invalid) {
      this.messages.push(({ severity: 'error', detail: 'El nombre es obligatorio' }));
    } else {
      if (dejarDeCompartir) {
      this.dejarDeCompartir.emit({uidsPermitidos: this.formEditLista.get('uidsPermitidos').value, nombre: this.formEditLista?.get('nombre')?.value, descripcion: 
        this.formEditLista?.get('descripcion')?.value || '', id: this.formEditLista.get('id').value, compartida: true} as Lista);
        this.visiblePopupEditarList = false;
        this.visiblePopupCompartirList = false;
        this.formEditLista.reset();
      } else {
        // Anadimos la lista
        this.setLista.emit({uidsPermitidos: this.formEditLista.get('uidsPermitidos').value, nombre: this.formEditLista?.get('nombre')?.value, descripcion: 
          this.formEditLista?.get('descripcion')?.value || '', id: this.formEditLista.get('id').value, compartida: this.formEditLista.get('compartida').value || false} as Lista);
          this.visiblePopupEditarList = false;
          this.visiblePopupCompartirList = false;
          this.formEditLista.reset();
      }
    }
  }

  copiarCodigoCompartir(): void {
    navigator.clipboard.writeText(this.formEditLista.get('id')?.value)
      .then(() => {
        this.messageService.add({
          severity: 'info',
          summary: 'Texto copiado',
          life: 3000
        });
      })
      .catch(err => {
        this.messageService.add({
          severity: 'error',
          summary: 'No se ha podido copiar',
          detail: `Intente manualmente`,
          life: 3000
        });
      });
  }

  pegarDelPortapapeles(): void {
    if (!navigator.clipboard) {
      this.messageService.add({
        severity: 'error',
        summary: 'Portapapeles no disponible',
        detail: 'Tu navegador no permite acceder al portapapeles',
        life: 3000
      });
      return;
    }
  
    navigator.clipboard.readText()
      .then((resp) => {
        this.formAddListaCompartida.get('id')?.setValue(resp);
      })
      .catch(err => {
        console.error('Error al pegar del portapapeles:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'No se ha podido pegar',
          detail: 'Intente pegar manualmente',
          life: 3000
        });
      });
  }  

  filtrarNombresListasElementos(event: AutoCompleteCompleteEvent) {
    let filtered: any[] = [];
    let query = event.query;

    for (let i = 0; i < (this.listas() as Lista[]).length; i++) {
        let lista = (this.listas() as Lista[])[i];
        if (normalizarCadena(lista.nombre).indexOf(normalizarCadena(query)) == 0) {
            filtered.push(lista);
        }
    }

    this.listasFiltradasElementos = filtered;
  }

  anadirListaCompartida() {
    if (this.formAddListaCompartida.invalid) {
      this.messages.push(({ severity: 'error', detail: 'El código es obligatorio' }));
    } else {
      // Anadimos la lista
      this.anadirCompartida.emit(this.formAddListaCompartida.get('id').value);
      this.visiblePopupEditarList = false;
      this.visiblePopupCompartirList = false;
      this.visiblePopupAnadirCompartida = false;
    }
  }
  
  predeterminarListaEmit(idLista: string) {
    this.predeterminarLista.emit(idLista);
  }
  
  eliminarListaEmit(lista: Lista, event: Event) {
    this.eliminarLista.emit({lista, event});
  }

  mostrarMensaje(mensaje: string) {
    this.confirmationService.confirm({
      message: mensaje,
      acceptButtonStyleClass: 'bg-white text-black p-button-sm',
      rejectVisible: false,
      acceptLabel: 'Entendido',
    });
  }
}
