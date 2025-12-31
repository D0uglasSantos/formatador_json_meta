
import { Component, signal, ChangeDetectionStrategy, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ExtractedItem {
  id: number;
  value: string;
  copied: WritableSignal<boolean>;
}

interface HistoryItem {
  id: number;
  json: string;
  copied: WritableSignal<boolean>;
  timestamp: string;
}

type AppTab = 'json' | 'image';
type JsonStatusType = 'success' | 'error' | 'idle';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class AppComponent {
  // --- General State ---
  activeTab = signal<AppTab>('json');

  // --- JSON Extractor State ---
  jsonInput = signal<string>('');
  extractedBases = signal<ExtractedItem[]>([]);
  jsonWithoutBase64 = signal<string>('');
  jsonCopied = signal<boolean>(false);
  error = signal<string>('');
  history = signal<HistoryItem[]>([]);
  jsonStatus = signal<{ message: string; type: JsonStatusType }>({ message: '', type: 'idle' });

  // --- Image to Base64 State ---
  imageBase64 = signal<string>('');
  imagePreview = signal<string | ArrayBuffer | null>(null);
  imageCopied = signal<boolean>(false);
  imageFileName = signal<string>('');

  // --- General Methods ---
  setActiveTab(tab: AppTab): void {
    this.activeTab.set(tab);
  }

  // --- JSON Extractor Methods ---
  private findSrcValues(obj: any, results: string[]): void {
    if (obj === null || typeof obj !== 'object') {
      return;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.findSrcValues(item, results);
      }
    } else {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if ((key === 'src' || key === 'image') && typeof obj[key] === 'string' && obj[key].startsWith('/9j/')) {
            results.push(obj[key]);
          } else {
            this.findSrcValues(obj[key], results);
          }
        }
      }
    }
  }

  private removeSrcValues(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removeSrcValues(item));
    }

    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if ((key === 'src' || key === 'image') && typeof obj[key] === 'string' && obj[key].startsWith('/9j/')) {
          newObj[key] = ''; // Set base64 string to empty
        } else {
          newObj[key] = this.removeSrcValues(obj[key]);
        }
      }
    }
    return newObj;
  }

  extractBase64(): void {
    this.error.set('');
    this.extractedBases.set([]);
    this.jsonWithoutBase64.set('');
    this.jsonStatus.set({ message: '', type: 'idle' });
    const inputValue = this.jsonInput();

    if (!inputValue.trim()) {
      this.error.set('A entrada JSON não pode estar vazia.');
      this.jsonStatus.set({ message: 'A entrada JSON não pode estar vazia.', type: 'error' });
      return;
    }

    try {
      // Sanitize the input by removing trailing commas which are invalid in strict JSON.
      let sanitizedJsonString = inputValue.trim().replace(/,(?=\s*[}\]])/g, '');
      if (sanitizedJsonString.endsWith(',')) {
        sanitizedJsonString = sanitizedJsonString.slice(0, -1);
      }

      const parsedJson = JSON.parse(sanitizedJsonString);
      this.jsonStatus.set({ message: 'JSON válido e formatado com sucesso!', type: 'success' });
      
      const results: string[] = [];
      this.findSrcValues(parsedJson, results);
      
      const uniqueResults = [...new Set(results)];

      this.extractedBases.set(uniqueResults.map((val, index) => ({
        id: index,
        value: val,
        copied: signal(false)
      })));

      const jsonCleaned = this.removeSrcValues(parsedJson);
      const cleanedJsonString = JSON.stringify(jsonCleaned, null, 2);
      this.jsonWithoutBase64.set(cleanedJsonString);

      const newHistoryItem: HistoryItem = {
        id: Date.now(),
        json: cleanedJsonString,
        copied: signal(false),
        timestamp: new Date().toLocaleString('pt-BR')
      };
      this.history.update(current => [newHistoryItem, ...current].slice(0, 3));

    } catch (e) {
      this.error.set('Formato JSON inválido. Por favor, verifique sua entrada.');
      this.jsonStatus.set({ message: 'Formato JSON inválido. Verifique sua entrada.', type: 'error' });
      console.error(e);
    }
  }

  copyToClipboard(item: ExtractedItem): void {
    navigator.clipboard.writeText(item.value).then(() => {
      item.copied.set(true);
      setTimeout(() => item.copied.set(false), 2000);
    }).catch(err => console.error('Failed to copy text: ', err));
  }

  copyJsonWithoutBase64(): void {
    navigator.clipboard.writeText(this.jsonWithoutBase64()).then(() => {
      this.jsonCopied.set(true);
      setTimeout(() => this.jsonCopied.set(false), 2000);
    }).catch(err => console.error('Failed to copy JSON: ', err));
  }
  
  copyHistoryItem(item: HistoryItem): void {
    navigator.clipboard.writeText(item.json).then(() => {
      this.history().forEach(h => h.copied.set(false));
      item.copied.set(true);
      setTimeout(() => item.copied.set(false), 2000);
    }).catch(err => console.error('Failed to copy history item: ', err));
  }

  clearJsonInput(): void {
    this.jsonInput.set('');
    this.extractedBases.set([]);
    this.jsonWithoutBase64.set('');
    this.jsonCopied.set(false);
    this.error.set('');
    this.history.set([]);
    this.jsonStatus.set({ message: '', type: 'idle' });
  }

  // --- Image to Base64 Methods ---
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.imageFileName.set(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result) {
            this.imagePreview.set(result);
            this.imageBase64.set(result.toString());
        }
      };
      reader.readAsDataURL(file);
    }
  }

  copyImageBase64(): void {
    if (!this.imageBase64()) return;
    navigator.clipboard.writeText(this.imageBase64()).then(() => {
        this.imageCopied.set(true);
        setTimeout(() => this.imageCopied.set(false), 2000);
    }).catch(err => console.error('Failed to copy image base64: ', err));
  }

  clearImageSelection(): void {
    this.imageBase64.set('');
    this.imagePreview.set(null);
    this.imageCopied.set(false);
    this.imageFileName.set('');
  }
}
