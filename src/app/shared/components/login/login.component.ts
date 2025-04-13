import { Component, effect, EventEmitter, Output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastMessageOptions, MessageService } from 'primeng/api';
import { StorageService } from '../../services/storage.service';
import { AuthService, SocialLoginMethods } from '../../services/auth.service';
import { PrimeNgModule } from '../../style/prime-ng/prime-ng.module';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [PrimeNgModule, ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  @Output() loguearse: EventEmitter<void> = new EventEmitter<void>;
  visiblePopup = signal<boolean>(false);
  visibleRegisterPopup: boolean = false;
  visibleLoginPopup: boolean = false;
  form: FormGroup;
  loadingLoginRegister: boolean = false;
  messages: ToastMessageOptions[] = [];
  socialLoginMethods = SocialLoginMethods;
  lastTimeVerification: Date | null = null;
  lastTimePasswordReset: Date | null = null;

  constructor(private readonly fb: FormBuilder, private readonly storageService: StorageService, private readonly authService: AuthService, private readonly router: Router, private messageService: MessageService) {
    this.form = this.fb.group({
      email: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      passwordConfirmation: [''],
    });
    effect(() => {
      if (!this.visiblePopup()) {
        this.visibleRegisterPopup = false;
        this.visibleLoginPopup = false;
        this.messages = [];
      }
    })
  }

  public get visiblePopupVariable() : boolean {
    return this.visiblePopup();
  }

  public set visiblePopupVariable(v : boolean) {
    this.visiblePopup.set(v);
  }
  
  public get loggedIn() : boolean {
    // return this.authService.getCurrentUser() != null; //It is a bit slow to detect it on first instance
    return this.storageService.isLoggedIn(); //In case we use localStorage
  } 

  public get errors() : boolean {
    return this.messages.some(err => err.severity == 'error');
  }

  public get verifyEmail() : boolean {
    return this.messages.some(err => err.detail?.includes('verify'));
  }
  
  private resetPasswordDifference() {
    if (this.lastTimePasswordReset == null) {
      return 60;
    }
    return (new Date().getTime() - this.lastTimePasswordReset.getTime()) / 1000;
  }

  /* Returns true when it is allowed to send reset to email */
  allowedResetPassword() {
    if (this.lastTimePasswordReset == null) {
      return true; // No previous verification, allow operation
    }
    const differenceInSeconds = (new Date().getTime() - this.lastTimePasswordReset.getTime()) / 1000;
    // Return true if more than 1 minute has passed
    return differenceInSeconds > 60;
  } 

  resetPassword() {
    if (this.allowedResetPassword()) {
      this.authService.sendPasswordResetEmail(this.form.get('email')?.value);
      this.lastTimePasswordReset = new Date();
      this.messages = [{ severity: 'success', detail: 'Reseteo de contraseña enviado a tu email' }];
    } else {
      this.messages = [{ severity: 'error', detail: 'Email o contraseña incorrectos' }, { severity: 'info', detail: `Por favor, espera ${60 - +this.resetPasswordDifference().toFixed(0)} segundos` }];
    }
  }

  private verificationDifference() {
    if (this.lastTimeVerification == null) {
      return 60;
    }
    return (new Date().getTime() - this.lastTimeVerification.getTime()) / 1000;
  }

  /* Returns true when it is allowed to verify */
  allowedVerifyCooldown() {
    if (this.lastTimeVerification == null) {
      return true; // No previous verification, allow operation
    }
    const differenceInSeconds = (new Date().getTime() - this.lastTimeVerification.getTime()) / 1000;
    // Return true if more than 1 minute has passed
    return differenceInSeconds > 60;
  } 

  sendEmailVerification() {
    /* User cannot send another email unless 1 minute passes */
    if (this.allowedVerifyCooldown()) {
      this.authService.sendVerificationEmail(this.authService.getCurrentUser()!);
      this.lastTimeVerification = new Date();
      this.messages = [{ severity: 'success', detail: 'Verificación de email enviada' }];
    } else {
      this.messages = [{ severity: 'warn', detail: 'Por favor, verifica tu email para iniciar sesión' }, { severity: 'info', detail: `Por favor, espera ${60 - +this.verificationDifference().toFixed(0)} segundos` }];
    }
  }

  loginRegister() {
    this.messages = [];
    if ((this.form.valid && !this.visibleRegisterPopup) || (this.form.valid && this.visibleRegisterPopup && this.form.get('password')?.value == this.form.get('passwordConfirmation')?.value)) {
      this.loadingLoginRegister = true;
      this.authService.loginRegister(this.form.get('email')?.value, this.form.get('password')?.value, this.visibleRegisterPopup).then((userCredential) => {
        /* We get the token to save it for our own backend if we need it */
        userCredential.user.getIdToken(true).then((token) => {
          if (this.visibleRegisterPopup) {
            this.authService.sendVerificationEmail(userCredential.user);
            this.messageService.add({ severity: 'info', summary: 'Registro correcto', detail: 'Registrado correctamente. Por favor, verifique su email', life: 3000 });
            this.visiblePopup.set(false);
          } else if (userCredential.user.emailVerified) {
            /* Verify the email, if not, user cannot login */
              this.storageService.saveUser({
                email: userCredential.user.email!,
                token: token
              });
              this.visiblePopup.set(false);
              this.messageService.add({ severity: 'info', summary: 'Inicio de sesión exitoso', life: 3000 });
              this.loguearse.emit();
            } else {
              this.messages = [{ severity: 'warn', detail: 'Por favor, verifica tu email para iniciar sesión' }];
          }
        });
      })
      .catch((err: Error) => {
        if (this.visibleRegisterPopup) {
          if (err.message.includes('email-already-in-use')) {
            this.messages = [{ severity: 'error', detail: 'El email ya está en uso' }];
          } else {
            console.error(err);
          }
        } else {
          this.messages = [{ severity: 'error', detail: 'Email o contraseña incorrectos' }];
        }
        console.log(err);
      })
      .finally(() => {
        this.form.get('password')?.reset();
        this.form.get('passwordConfirmation')?.reset();
        this.loadingLoginRegister = false;
      });
    } else {
      this.form.markAllAsTouched();
      if (this.form.get('email')?.invalid) {
        this.messages.push({ severity: 'warn', detail: 'Debes poner un email real' });
      }
      if (this.form.get('password')?.invalid) {
        this.messages.push({ severity: 'warn', detail: 'La contraseña debe ser al menos de 6 caracteres y máximo 30, y no puede contener <code>|\\/</code>' });
      }
      if (this.visibleRegisterPopup && this.form.get('password')?.value != this.form.get('passwordConfirmation')?.value) {
        this.messages.push({ severity: 'warn', detail: "Las contraseñas no coinciden" });
      }
    }
  }

  changeToRegister() {
    this.visiblePopup.set(false);
    this.visiblePopup.set(true);
    this.messages = [];
    this.visibleRegisterPopup = true;
  }

  //Instead of using lots of methods, I prefer to unify it (just a way, you can vary it)
  socialLogin(socialLoginMethod: SocialLoginMethods) {
    this.authService.socialLogin(socialLoginMethod).then((userCredential) => {
      userCredential.user.getIdToken(true).then((token) => {
        this.storageService.saveUser({
          email: userCredential.user.email!,
          token: token
        });
        this.visiblePopup.set(false);
        if (this.visibleRegisterPopup) {
          this.messageService.add({ severity: 'info', summary: 'Registro correcto', detail: 'Registrado correctamente. Por favor, verifique su email', life: 3000 });
        } else {
          this.loguearse.emit();
          this.messageService.add({ severity: 'info', summary: 'Inicio de sesión exitoso', life: 3000 });
        }
      });
    })
    .catch((err) => {
      console.error(err);
      this.messageService.add({ severity: 'error', summary: 'Algo fue mal', detail: 'Inténtalo de nuevo', life: 3000 });
    });
  }

  logout() {
    this.authService.logout();
  }
}
