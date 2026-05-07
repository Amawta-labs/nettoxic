export const testCases = [
  {
    source: "email" as const,
    sender: "alerta@bancoestado-seguro.click",
    subject: "Ultimo aviso",
    content:
      "BancoEstado: su cuenta sera bloqueada en 24 horas. Valide su clave ahora en https://bancoestado-seguro.click/login"
  },
  {
    source: "sms" as const,
    sender: "+56912345678",
    content:
      "SII informa multa pendiente. Regularice hoy ingresando con su clave tributaria en https://sii-pagos.xyz"
  },
  {
    source: "email" as const,
    sender: "notificaciones@mercadolibre.cl",
    subject: "Compra recibida",
    content: "Tu compra fue confirmada. Revisa el detalle entrando manualmente a Mercado Libre."
  },
  {
    source: "email" as const,
    sender: "alerta@fakebancoestado.cl",
    subject: "Dominio parecido",
    content:
      "BancoEstado: valide su clave en https://fakebancoestado.cl/login para evitar bloqueo."
  },
  {
    source: "sms" as const,
    sender: "+56911111111",
    content:
      "BancoEstado: su cuenta será suspendida. Ingrese su contraseña en https://bancoestado-seguro.click/login"
  },
  {
    source: "sms" as const,
    sender: "+56922222222",
    content: "Correos de Chile: paquete retenido por pago pendiente. Pague despacho en https://correos-verifica.xyz"
  },
  {
    source: "sms" as const,
    sender: "+56933333333",
    content: "Ganaste un bono pendiente. Valida tu identidad y datos bancarios hoy para recibir el deposito."
  },
  {
    source: "sms" as const,
    sender: "+56944444444",
    content: "Soporte tecnico del banco detecto un problema. Instala AnyDesk y comparte el codigo para proteger tu cuenta."
  },
  {
    source: "sms" as const,
    sender: "+56955555555",
    content: "Tu transferencia fue retenida. Ingresa al enlace y valida el pago urgente para liberar el saldo."
  }
];
