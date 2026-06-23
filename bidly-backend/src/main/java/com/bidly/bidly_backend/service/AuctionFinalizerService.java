package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.*;
import com.bidly.bidly_backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@Service
public class AuctionFinalizerService {

    private static final int MINUTOS_INACTIVIDAD = 30;

    @Autowired private ItemCatalogoRepository itemCatalogoRepository;
    @Autowired private PujoFechaRepository pujoFechaRepository;
    @Autowired private PujaRepository pujaRepository;
    @Autowired private RegistroDeSubastaRepository registroDeSubastaRepository;
    @Autowired private SubastaRepository subastaRepository;
    @Autowired private NotificacionService notificacionService;

    @Scheduled(fixedDelay = 60000)
    public void finalizarItemsVencidos() {
        LocalDateTime ahora = LocalDateTime.now();
        LocalDateTime limite = ahora.minusMinutes(MINUTOS_INACTIVIDAD);
        List<ItemCatalogo> activos = itemCatalogoRepository.findItemsActivosEnSubastasAbiertas();

        for (ItemCatalogo item : activos) {
            Subasta subasta = item.getCatalogo().getSubasta();
            if (subasta == null || !"abierta".equals(subasta.getEstado())) continue;

            LocalDateTime inicio = inicioSubasta(subasta);
            if (inicio != null && inicio.isAfter(ahora)) continue;

            Optional<LocalDateTime> ultimaFecha = pujoFechaRepository.findUltimaFechaByItemId(item.getIdentificador());

            if (ultimaFecha.isEmpty()) {
                if (inicio == null || inicio.plusMinutes(MINUTOS_INACTIVIDAD).isAfter(ahora)) continue;
                cerrarItemSinPujas(item);
                cerrarSubastaSiCorresponde(subasta);
                continue;
            }

            if (ultimaFecha.get().isAfter(limite)) continue;

            Optional<Puja> topPuja = pujaRepository.findTopByItemIdentificadorOrderByImporteDesc(item.getIdentificador());
            if (topPuja.isEmpty()) {
                cerrarItemSinPujas(item);
                cerrarSubastaSiCorresponde(subasta);
                continue;
            }

            Puja ganadora = topPuja.get();
            ganadora.setGanador("si");
            pujaRepository.save(ganadora);

            item.setSubastado("si");
            itemCatalogoRepository.save(item);

            RegistroDeSubasta registro = new RegistroDeSubasta();
            registro.setSubasta(subasta);
            registro.setProducto(item.getProducto().getIdentificador());
            registro.setDuenio(item.getProducto().getDuenio());
            registro.setCliente(ganadora.getAsistente().getCliente());
            registro.setImporte(ganadora.getImporte());
            registro.setComision(item.getComision());
            registroDeSubastaRepository.save(registro);

            Cliente ganador = ganadora.getAsistente().getCliente();
            String producto = item.getProducto().getDescripcionCatalogo();
            notificacionService.crear(ganador.getIdentificador(), "ganaste",
                    "Ganaste " + producto + " por $" + ganadora.getImporte());

            notificarCierreParcial(subasta);
            cerrarSubastaSiCorresponde(subasta);
        }

        cerrarSubastasCompletasAbiertas();
    }

    private void cerrarItemSinPujas(ItemCatalogo item) {
        item.setSubastado("si");
        itemCatalogoRepository.save(item);
    }

    private void cerrarSubastaSiCorresponde(Subasta subasta) {
        boolean todosFinalizados = itemCatalogoRepository
                .findByCatalogoSubastaIdentificador(subasta.getIdentificador())
                .stream().allMatch(i -> "si".equals(i.getSubastado()));
        if (todosFinalizados) {
            subasta.setEstado("cerrada");
            subastaRepository.save(subasta);
            notificacionService.notificarAsistentesSubasta(subasta.getIdentificador(), "subasta_por_cerrar",
                    "La subasta #" + subasta.getIdentificador() + " finalizó.");
        }
    }

    private void notificarCierreParcial(Subasta subasta) {
        long pendientes = itemCatalogoRepository
                .findByCatalogoSubastaIdentificador(subasta.getIdentificador())
                .stream()
                .filter(i -> !"si".equals(i.getSubastado()))
                .count();
        if (pendientes == 1) {
            notificacionService.notificarAsistentesSubasta(subasta.getIdentificador(), "subasta_por_cerrar",
                    "Queda 1 ítem en la subasta #" + subasta.getIdentificador() + ". Pronto finalizará.");
        }
    }

    private void cerrarSubastasCompletasAbiertas() {
        for (Subasta subasta : subastaRepository.findByEstado("abierta")) {
            List<ItemCatalogo> items = itemCatalogoRepository.findByCatalogoSubastaIdentificador(subasta.getIdentificador());
            if (items.isEmpty()) continue;
            boolean todos = items.stream().allMatch(i -> "si".equals(i.getSubastado()));
            if (todos) {
                subasta.setEstado("cerrada");
                subastaRepository.save(subasta);
            }
        }
    }

    private LocalDateTime inicioSubasta(Subasta subasta) {
        if (subasta.getFecha() == null) return null;
        LocalTime hora = subasta.getHora() != null ? subasta.getHora() : LocalTime.MIDNIGHT;
        return LocalDateTime.of(subasta.getFecha(), hora);
    }
}
