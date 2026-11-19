export const cyrillic = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
export const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const alphabet = cyrillic + latin + '#';

export const fields = {
  full_name: { label: 'Имя', max: 120 },
  phone: { label: 'Телефон', max: 32 },
  email: { label: 'Email', max: 254 },
  notes: { label: 'Заметки', max: 2000 },
};

const phoneFormat = /^\+?[0-9 ()-]+$/;
const emailFormat = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

export function phoneDigits(value) {
  return value.replace(/[^0-9]/g, '');
}

export function phoneSearch(value) {
  return phoneFormat.test(value) ? phoneDigits(value) : '';
}

export function firstLetter(name) {
  const first = name[0] ?? '';
  if (!first || (!alphabet.includes(first) && !alphabet.toLowerCase().includes(first))) return '#';
  return first.toUpperCase();
}

export function cleanField(field, value) {
  const trimmed = value.trim();
  return field === 'full_name' ? trimmed.normalize('NFC') : trimmed;
}

export function validateField(field, value) {
  const { label, max } = fields[field];
  if (typeof value !== 'string' || value.includes('\0')) {
    return `Поле «${label}» должно содержать текст.`;
  }

  const text = cleanField(field, value);
  if (field !== 'notes' && !text) return `Заполните поле «${label}».`;
  if (text.length > max) return `Поле «${label}» вмещает до ${max} символов.`;
  if (field === 'full_name' && /[\r\n\t]/.test(text)) return 'Введите имя в одну строку.';
  if (field === 'phone' && (!phoneFormat.test(text) || !/^\d{7,15}$/.test(phoneDigits(text)))) {
    return 'Введите телефон из 7–15 цифр. Допустимы + в начале, пробелы, скобки и дефисы.';
  }
  if (field === 'email' && !emailFormat.test(text)) return 'Введите email в формате name@example.com.';
  return '';
}
