import { PDFDocument, PDFFont, PDFPage, RGB, rgb } from 'pdf-lib';

// Shared interface for template rendering
export interface TemplateContext {
  pdfDoc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  name: string;
  email: string;
  phone: string;
  location: string;
  body: string;
  PAGE_WIDTH: number;
  PAGE_HEIGHT: number;
}

export function normalizeBoldMarkers(text: string): string {
  // Step 1: Match **...** patterns that may contain newlines or extra whitespace
  // and normalize the content inside them
  let normalized = text.replace(/\*\*([^*]*(?:\*(?!\*)[^*]*)*)\*\*/g, (match, content) => {
    // Replace newlines and multiple spaces with a single space
    const cleanContent = content.replace(/\s+/g, ' ').trim();
    if (!cleanContent) return ''; // Remove empty bold markers
    return `**${cleanContent}**`;
  });
  
  // Step 2: Remove orphaned/unbalanced ** markers
  // Count pairs and remove unmatched ones
  const parts = normalized.split('**');
  if (parts.length % 2 === 0) {
    // Odd number of ** markers means unbalanced - remove trailing orphan
    // Reconstruct by pairing: text, bold, text, bold, ... , text, orphan-text
    const result: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Regular text
        result.push(parts[i]);
      } else if (i < parts.length - 1) {
        // Bold text (has closing **)
        result.push(`**${parts[i]}**`);
      } else {
        // Last part after orphan ** - just append without markers
        result.push(parts[i]);
      }
    }
    normalized = result.join('');
  }
  
  return normalized;
}

// Helper to parse resume text
export function parseResume(resumeText: string): {
  headline: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  body: string;
} {
  const normalizedText = normalizeBoldMarkers(resumeText);
  const lines = normalizedText.split('\n');
  const info: string[] = [];
  let bodyStart = 0;
  for (let idx = 0; idx < lines.length; idx++) {
    if (lines[idx].trim()) info.push(lines[idx].trim());
    if (info.length === 6) {
      bodyStart = idx + 1;
      break;
    }
  }
  const [headline = '', name = '', email = '', phone = '', location = '', linkedin = ''] = info;
  while (bodyStart < lines.length && !lines[bodyStart].trim()) bodyStart++;
  const body = lines.slice(bodyStart).join('\n');
  return { headline, name, email, phone, location, linkedin, body };
}

// Helper to convert date format from MM/YYYY to MMM YYYY
export function formatDate(dateStr: string): string {
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Handle different date formats
  if (dateStr.includes('–') || dateStr.includes('-')) {
    // Split by dash and format each part
    const parts = dateStr.split(/[–-]/).map(part => part.trim());
    return parts.map(part => {
      if (part.match(/^\d{2}\/\d{4}$/)) {
        const [month, year] = part.split('/');
        const monthIndex = parseInt(month) - 1;
        return `${monthNames[monthIndex]} ${year}`;
      }
      return part; // Return as-is if not in MM/YYYY format
    }).join(' – ');
  } else if (dateStr.match(/^\d{2}\/\d{4}$/)) {
    // Single date in MM/YYYY format
    const [month, year] = dateStr.split('/');
    const monthIndex = parseInt(month) - 1;
    return `${monthNames[monthIndex]} ${year}`;
  }

  return dateStr; // Return as-is if not in expected format
}

// Helper to wrap text within a max width
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
    const testWidth = font.widthOfTextAtSize(testLine, size);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Helper to wrap text with proper indentation for lines starting with prefixes (like '- ' or '· ')
export function wrapTextWithIndent(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): { lines: string[]; prefix: string; indentWidth: number } {
  // Convert '-' to '•' (bullet) for consistency
  const normalizedText = text.replace(/^(-\s+)/, '• ');
  
  // Detect common prefixes
  const prefixMatch = normalizedText.match(/^([\-\·•]\s+)/);
  const prefix = prefixMatch ? prefixMatch[1] : '';
  const content = prefix ? normalizedText.slice(prefix.length) : normalizedText;
  
  // Calculate prefix width for indentation
  const prefixWidth = prefix ? font.widthOfTextAtSize(prefix, size) : 0;
  
  // Wrap the content part
  const wrappedContent = wrapText(content, font, size, maxWidth - prefixWidth);
  
  // Build lines with prefix on first line only
  const lines: string[] = [];
  wrappedContent.forEach((line, index) => {
    if (index === 0) {
      lines.push(prefix + line);
    } else {
      lines.push(line);
    }
  });
  
  return {
    lines,
    prefix,
    indentWidth: prefixWidth
  };
}

// Helper to draw text with bold segments (markdown **bold**)
export function drawTextWithBold(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  fontBold: PDFFont,
  size: number,
  color: RGB
) {
   // First normalize the text to fix any malformed bold markers
   const normalizedText = normalizeBoldMarkers(text);
  
   // Split by **...** pattern, keeping the delimiters
   // This regex captures bold markers as separate array elements
   const parts = normalizedText.split(/(\*\*[^*]+\*\*)/g).filter(part => part !== '');
   
   let offsetX = x;
   for (const part of parts) {
     if (!part) continue;
     
     if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
       // Bold text - extract content without markers
       const content = part.slice(2, -2);
       if (content) {
         page.drawText(content, { x: offsetX, y, size, font: fontBold, color });
         offsetX += fontBold.widthOfTextAtSize(content, size);
       }
     } else {
       // Regular text - also clean up any stray ** that might have slipped through
       const cleanPart = part.replace(/\*\*/g, '');
       if (cleanPart) {
         page.drawText(cleanPart, { x: offsetX, y, size, font, color });
         offsetX += font.widthOfTextAtSize(cleanPart, size);
       }
     }
   }
}

// Color constants
export const COLORS = {
  BLACK: rgb(0, 0, 0),
  MEDIUM_GRAY: rgb(0.4, 0.4, 0.4),
  LIGHT_GRAY: rgb(0.6, 0.6, 0.6),
  DARK_GRAY: rgb(0.3, 0.3, 0.3),
};

// Helper to detect and parse education lines
// Formats like: "Bachelor's Degree in Computer Science — University of Barcelona, 2019"
// or "B.S. in Computer Science, University of Barcelona, 2019"
export function parseEducationLine(line: string): { degree: string; institution: string; year: string } | null {
  // Pattern 1: Degree — University, Year
  const pattern1 = line.match(/^(.+?)\s*[—–-]\s*(.+?),?\s*(\d{4})$/);
  if (pattern1) {
    return {
      degree: pattern1[1].trim(),
      institution: pattern1[2].trim().replace(/,\s*$/, ''),
      year: pattern1[3]
    };
  }
  
  // Pattern 2: Degree, University, Year (comma separated)
  const pattern2 = line.match(/^((?:Bachelor|Master|Doctor|Ph\.?D|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|MBA|Associate)[^,]+),\s*(.+?),?\s*(\d{4})$/i);
  if (pattern2) {
    return {
      degree: pattern2[1].trim(),
      institution: pattern2[2].trim().replace(/,\s*$/, ''),
      year: pattern2[3]
    };
  }
  
  // Pattern 3: Degree | University | Year (pipe separated)
  const pattern3 = line.match(/^(.+?)\s*\|\s*(.+?)\s*\|\s*(\d{4})$/);
  if (pattern3) {
    return {
      degree: pattern3[1].trim(),
      institution: pattern3[2].trim(),
      year: pattern3[3]
    };
  }
  
  return null;
}

// Helper to check if we're in an education section
export function isEducationSection(sectionHeader: string): boolean {
  const normalized = sectionHeader.toLowerCase();
  return normalized.includes('education') || normalized.includes('academic');
}

