package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Duenio;
import com.bidly.bidly_backend.model.Empleado;
import com.bidly.bidly_backend.model.Foto;
import com.bidly.bidly_backend.model.Producto;
import com.bidly.bidly_backend.repository.DuenioRepository;
import com.bidly.bidly_backend.repository.EmpleadoRepository;
import com.bidly.bidly_backend.repository.FotoRepository;
import com.bidly.bidly_backend.repository.ProductoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Random;

@RestController
@RequestMapping("/api/productos")
public class ProductoController {

    private static final Logger log = LoggerFactory.getLogger(ProductoController.class);

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private FotoRepository fotoRepository;

    @Autowired
    private DuenioRepository duenioRepository;

    @Autowired
    private EmpleadoRepository empleadoRepository;

    private final Random random = new Random();

    private Long empleadoAleatorio() {
        List<Empleado> empleados = empleadoRepository.findAll();
        if (empleados.isEmpty()) return 1L;
        return empleados.get(random.nextInt(empleados.size())).getIdentificador();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Producto> obtener(@PathVariable Long id) {
        return productoRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Producto> crear(@RequestBody Producto producto) {
        Long revisorId = empleadoAleatorio();
        producto.setRevisor(revisorId);

        Long duenioId = producto.getDuenio();
        log.info("PRODUCTO CREAR - duenio={} revisor={}", duenioId, revisorId);

        if (duenioId != null && !duenioRepository.existsById(duenioId)) {
            Duenio nuevo = new Duenio();
            nuevo.setIdentificador(duenioId);
            nuevo.setNumeroPais(1);
            nuevo.setVerificacionFinanciera("no");
            nuevo.setVerificacionJudicial("no");
            nuevo.setVerificador(revisorId);
            duenioRepository.save(nuevo);
            log.info("PRODUCTO CREAR - duenio={} auto-registrado en tabla duenios", duenioId);
        }

        Producto guardado = productoRepository.save(producto);
        log.info("PRODUCTO CREAR OK - id={} duenio={} revisor={}", guardado.getIdentificador(), duenioId, revisorId);
        return ResponseEntity.status(201).body(guardado);
    }

    @PatchMapping("/{id}/disponible")
    public ResponseEntity<?> toggleDisponible(@PathVariable Long id) {
        return productoRepository.findById(id)
                .map(p -> {
                    String nuevoEstado = "si".equals(p.getDisponible()) ? "no" : "si";
                    p.setDisponible(nuevoEstado);
                    return ResponseEntity.ok(productoRepository.save(p));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/fotos")
    public ResponseEntity<List<Long>> obtenerFotoIds(@PathVariable Long id) {
        if (!productoRepository.existsById(id)) return ResponseEntity.notFound().build();
        List<Long> ids = fotoRepository.findByProductoIdentificador(id).stream()
                .map(Foto::getIdentificador)
                .toList();
        return ResponseEntity.ok(ids);
    }

    @GetMapping(value = "/{id}/portada", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> portada(@PathVariable Long id) {
        List<Foto> fotos = fotoRepository.findByProductoIdentificador(id);
        if (fotos.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(fotos.get(0).getFoto());
    }

    @PostMapping(value = "/{id}/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> agregarFotos(@PathVariable Long id,
                                           @RequestPart("fotos") List<MultipartFile> archivos) {
        log.info("FOTOS UPLOAD - productoId={} archivos={}", id, archivos != null ? archivos.size() : "null");
        return productoRepository.findById(id)
                .map(producto -> {
                    if (archivos == null || archivos.isEmpty()) {
                        log.warn("FOTOS UPLOAD - productoId={} lista vacía", id);
                        return ResponseEntity.badRequest()
                                .<Object>body(Map.of("error", "La lista de fotos no puede estar vacía"));
                    }
                    for (MultipartFile archivo : archivos) {
                        try {
                            log.info("FOTOS UPLOAD - productoId={} archivo={} size={}B contentType={}",
                                    id, archivo.getOriginalFilename(), archivo.getSize(), archivo.getContentType());
                            Foto foto = new Foto();
                            foto.setProducto(producto);
                            foto.setFoto(archivo.getBytes());
                            fotoRepository.save(foto);
                        } catch (IOException e) {
                            log.error("FOTOS UPLOAD ERROR - productoId={} archivo={} error={}", id, archivo.getOriginalFilename(), e.getMessage());
                            return ResponseEntity.status(500)
                                    .<Object>body(Map.of("error", "Error leyendo archivo: " + archivo.getOriginalFilename()));
                        }
                    }
                    log.info("FOTOS UPLOAD OK - productoId={} guardadas={}", id, archivos.size());
                    return ResponseEntity.status(201)
                            .<Object>body(Map.of("guardadas", archivos.size()));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
