// Validation functions
export class Validator {
    static required(value) {
        return value !== undefined && value !== null && value !== '';
    }

    static minLength(value, min) {
        return value.length >= min;
    }

    static maxLength(value, max) {
        return value.length <= max;
    }

    static email(value) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(value);
    }

    static username(value) {
        const re = /^[a-zA-Z0-9_]{3,20}$/;
        return re.test(value);
    }

    static password(value) {
        return value.length >= 6;
    }

    static number(value, min = null, max = null) {
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        
        if (min !== null && num < min) return false;
        if (max !== null && num > max) return false;
        
        return true;
    }

    static integer(value, min = null, max = null) {
        const num = parseInt(value);
        if (isNaN(num)) return false;
        
        if (min !== null && num < min) return false;
        if (max !== null && num > max) return false;
        
        return true;
    }

    static between(value, min, max) {
        return value >= min && value <= max;
    }

    static url(value) {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }

    static date(value) {
        return !isNaN(Date.parse(value));
    }

    static phone(value) {
        const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        return re.test(value);
    }

    static matches(value, pattern) {
        return pattern.test(value);
    }

    static custom(value, callback) {
        return callback(value);
    }
}

// Form validation system
export class FormValidator {
    constructor(rules) {
        this.rules = rules;
        this.errors = {};
    }

    validate(data) {
        this.errors = {};
        
        for (const [field, fieldRules] of Object.entries(this.rules)) {
            const value = data[field];
            
            for (const rule of fieldRules) {
                const { type, message, params = [] } = rule;
                
                let isValid = true;
                
                switch (type) {
                    case 'required':
                        isValid = Validator.required(value);
                        break;
                    case 'minLength':
                        isValid = Validator.minLength(value, params[0]);
                        break;
                    case 'maxLength':
                        isValid = Validator.maxLength(value, params[0]);
                        break;
                    case 'email':
                        isValid = Validator.email(value);
                        break;
                    case 'username':
                        isValid = Validator.username(value);
                        break;
                    case 'password':
                        isValid = Validator.password(value);
                        break;
                    case 'number':
                        isValid = Validator.number(value, params[0], params[1]);
                        break;
                    case 'integer':
                        isValid = Validator.integer(value, params[0], params[1]);
                        break;
                    case 'between':
                        isValid = Validator.between(value, params[0], params[1]);
                        break;
                    case 'matches':
                        isValid = Validator.matches(value, params[0]);
                        break;
                    case 'custom':
                        isValid = Validator.custom(value, params[0]);
                        break;
                }
                
                if (!isValid) {
                    if (!this.errors[field]) {
                        this.errors[field] = [];
                    }
                    this.errors[field].push(message);
                    break; // Stop checking other rules for this field
                }
            }
        }
        
        return Object.keys(this.errors).length === 0;
    }

    getErrors() {
        return this.errors;
    }

    getFieldErrors(field) {
        return this.errors[field] || [];
    }

    hasErrors() {
        return Object.keys(this.errors).length > 0;
    }

    clearErrors() {
        this.errors = {};
    }
}

// Predefined validation rules
export const ValidationRules = {
    username: [
        { type: 'required', message: 'Benutzername ist erforderlich' },
        { type: 'minLength', params: [3], message: 'Benutzername muss mindestens 3 Zeichen haben' },
        { type: 'maxLength', params: [20], message: 'Benutzername darf maximal 20 Zeichen haben' },
        { type: 'username', message: 'Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten' }
    ],
    
    email: [
        { type: 'required', message: 'E-Mail ist erforderlich' },
        { type: 'email', message: 'Bitte gib eine gültige E-Mail-Adresse ein' }
    ],
    
    password: [
        { type: 'required', message: 'Passwort ist erforderlich' },
        { type: 'minLength', params: [6], message: 'Passwort muss mindestens 6 Zeichen haben' }
    ],
    
    betAmount: [
        { type: 'required', message: 'Einsatz ist erforderlich' },
        { type: 'number', params: [1], message: 'Einsatz muss eine Zahl sein' },
        { type: 'minLength', params: [1], message: 'Einsatz muss mindestens 1 Chip sein' }
    ],
    
    chatMessage: [
        { type: 'required', message: 'Nachricht darf nicht leer sein' },
        { type: 'maxLength', params: [200], message: 'Nachricht darf maximal 200 Zeichen haben' }
    ]
};

// Real-time input validation
export function setupInputValidation(input, rules) {
    const validator = new FormValidator({ [input.name]: rules });
    const errorContainer = document.createElement('div');
    errorContainer.className = 'validation-error';
    
    input.parentNode.appendChild(errorContainer);
    
    function validate() {
        const data = { [input.name]: input.value };
        validator.validate(data);
        const errors = validator.getFieldErrors(input.name);
        
        if (errors.length > 0) {
            input.classList.add('invalid');
            input.classList.remove('valid');
            errorContainer.textContent = errors[0];
            errorContainer.style.display = 'block';
            return false;
        } else {
            input.classList.remove('invalid');
            input.classList.add('valid');
            errorContainer.style.display = 'none';
            return true;
        }
    }
    
    input.addEventListener('input', validate);
    input.addEventListener('blur', validate);
    
    return {
        validate,
        destroy: () => {
            input.removeEventListener('input', validate);
            input.removeEventListener('blur', validate);
            errorContainer.remove();
        }
    };
}

// Add validation styles
const validationStyles = document.createElement('style');
validationStyles.textContent = `
    .validation-error {
        color: #f44336;
        font-size: 12px;
        margin-top: 5px;
        display: none;
    }
    
    input.invalid {
        border-color: #f44336 !important;
    }
    
    input.valid {
        border-color: #4CAF50 !important;
    }
`;
document.head.appendChild(validationStyles);