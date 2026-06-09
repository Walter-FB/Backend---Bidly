package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Cliente;
import com.bidly.bidly_backend.model.MedioPago;
import com.bidly.bidly_backend.repository.ClienteRepository;
import com.bidly.bidly_backend.repository.MedioPagoRepository;
import com.bidly.bidly_backend.repository.PersonaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/clientes")
public class ClienteController {

    private static final Set<String> CATEGORIAS_VALIDAS =
            Set.of("comun", "especial", "plata", "oro", "platino");

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private MedioPagoRepository medioPagoRepository;

    @Autowired
    private PersonaRepository personaRepository;

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Cliente cliente) {
        if (cliente.getIdentificador() == null || !personaRepository.existsById(cliente.getIdentificador())) {
            return ResponseEntity.badRequest().body(Map.of("error", "La persona no existe"));
        }
        return ResponseEntity.status(201).body(clienteRepository.save(cliente));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Cliente> obtener(@PathVariable Long id) {
        return clienteRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/categoria")
    public ResponseEntity<?> actualizarCategoria(@PathVariable Long id,
                                                  @RequestBody Map<String, String> body) {
        String categoria = body.get("categoria");
        if (categoria == null || !CATEGORIAS_VALIDAS.contains(categoria)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Categoría inválida. Valores permitidos: " + CATEGORIAS_VALIDAS));
        }
        return clienteRepository.findById(id)
                .map(c -> {
                    c.setCategoria(categoria);
                    return ResponseEntity.ok((Object) clienteRepository.save(c));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/admitido")
    public ResponseEntity<?> actualizarAdmitido(@PathVariable Long id,
                                                 @RequestBody Map<String, String> body) {
        String valor = body.get("admitido");
        if (!"si".equals(valor) && !"no".equals(valor)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "El campo 'admitido' debe ser 'si' o 'no'"));
        }
        return clienteRepository.findById(id)
                .map(c -> {
                    c.setAdmitido(valor);
                    return ResponseEntity.ok((Object) clienteRepository.save(c));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/medios-pago")
    public ResponseEntity<?> listarMediosPago(@PathVariable Long id) {
        if (!clienteRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        List<MedioPago> medios = medioPagoRepository.findByClienteIdentificador(id);
        return ResponseEntity.ok(medios);
    }

    @PostMapping("/{id}/medios-pago")
    public ResponseEntity<?> agregarMedioPago(@PathVariable Long id,
                                               @RequestBody MedioPago medioPago) {
        return clienteRepository.findById(id)
                .map(cliente -> {
                    medioPago.setCliente(cliente);
                    MedioPago guardado = medioPagoRepository.save(medioPago);
                    return ResponseEntity.status(201).<Object>body(guardado);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
