
import { Component, signal, ChangeDetectionStrategy, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ExtractedItem {
  id: number;
  value: string;
  copied: WritableSignal<boolean>;
}

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
  jsonInput = signal<string>('');
  extractedBases = signal<ExtractedItem[]>([]);
  jsonWithoutBase64 = signal<string>('');
  jsonCopied = signal<boolean>(false);
  error = signal<string>('');
  
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
          if (key === 'src' && typeof obj[key] === 'string' && obj[key].startsWith('/9j/')) {
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
        if (key === 'src' && typeof obj[key] === 'string' && obj[key].startsWith('/9j/')) {
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
    const inputValue = this.jsonInput();

    if (!inputValue.trim()) {
      this.error.set('JSON input cannot be empty.');
      return;
    }

    try {
      const parsedJson = JSON.parse(inputValue);
      
      const results: string[] = [];
      this.findSrcValues(parsedJson, results);
      
      const uniqueResults = [...new Set(results)];

      this.extractedBases.set(uniqueResults.map((val, index) => ({
        id: index,
        value: val,
        copied: signal(false)
      })));

      const jsonCleaned = this.removeSrcValues(parsedJson);
      this.jsonWithoutBase64.set(JSON.stringify(jsonCleaned, null, 2));

    } catch (e) {
      this.error.set('Invalid JSON format. Please check your input.');
      console.error(e);
    }
  }

  copyToClipboard(item: ExtractedItem): void {
    navigator.clipboard.writeText(item.value).then(() => {
      item.copied.set(true);
      setTimeout(() => {
        item.copied.set(false);
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  copyJsonWithoutBase64(): void {
    navigator.clipboard.writeText(this.jsonWithoutBase64()).then(() => {
      this.jsonCopied.set(true);
      setTimeout(() => {
        this.jsonCopied.set(false);
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy JSON: ', err);
    });
  }
}
